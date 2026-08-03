import { requireRole } from "@/lib/auth/guards";
import { setPasswordAndRevokeLinks } from "@/lib/db/repo/resetTokens";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { withHashSlot } from "@/lib/auth/hashGate";
import { checkThrottle, clearThrottle, passwordCheckKey, recordFailure } from "@/lib/auth/throttle";

export const runtime = "nodejs";

// Any signed-in user (including read-only) may change their own password.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const current = typeof b.current === "string" ? b.current : "";
  const next = typeof b.next === "string" ? b.next : "";
  const pwError = passwordPolicyError(next);
  if (pwError) return Response.json({ error: `New password rejected: ${pwError}` }, { status: 400 });
  const db = await getDb();
  const user = await getUserById(db, guard.user.id);
  if (!user) return Response.json({ error: "Not found." }, { status: 404 });
  // This route verifies a password, so it is a password oracle for anyone
  // holding a session — throttled on the same terms as login.
  const key = passwordCheckKey(user.id);
  const now = new Date();
  const throttled = await checkThrottle(db, key, now);
  if (throttled.locked) {
    return Response.json(
      { error: `Too many failed attempts. Try again in ${throttled.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(throttled.retryAfterSec) } }
    );
  }
  // Through the same process-wide cap the login path uses.
  //
  // The per-account meter above is check-then-act: it is a SELECT, and nothing
  // increments until line 40, so a burst of concurrent requests all read the
  // same unlocked state and all proceed. That is survivable only because
  // something else bounds the work — and this route was running cost-12 bcrypt
  // outside that bound. bcryptjs chunks over setImmediate on the one event
  // loop, so a couple of hundred parallel wrong-password POSTs from any
  // signed-in account (readonly included) meant minutes of loop time and a
  // frozen app for every clinician mid-note, with the meter locking the
  // attacker's own key only afterwards. hashGate is the bound that does not
  // depend on winning a race.
  const check = await withHashSlot(() => verifyPassword(current, user.passHash));
  if (!check.ok) {
    return Response.json(
      { error: "The server is busy verifying sign-ins. Try again in a moment." },
      { status: 503, headers: { "retry-after": "2" } }
    );
  }
  if (!check.value) {
    await recordFailure(db, key, now);
    return Response.json({ error: "Your current password is wrong." }, { status: 403 });
  }
  await clearThrottle(db, key);
  // Hashing is as expensive as verifying, so it takes a slot too. Reached only
  // after a correct current password, so an attacker cannot drive it at all.
  const hashed = await withHashSlot(() => hashPassword(next));
  if (!hashed.ok) {
    return Response.json(
      { error: "The server is busy. Your password was not changed — try again in a moment." },
      { status: 503, headers: { "retry-after": "2" } }
    );
  }
  // Revokes every session minted before this instant — including this one.
  // Changing your password after a compromise must sign the attacker out,
  // and "signs you out everywhere" is the honest, expected trade.
  await setPasswordAndRevokeLinks(db, user.id, hashed.value, new Date());
  await logAction(db, {
    actorId: user.id,
    actorName: `${user.displayName} (${user.username})`,
    action: "user.self-password"
  });
  return Response.json({ ok: true, reauth: true });
}
