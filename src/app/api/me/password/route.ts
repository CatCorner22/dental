import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
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
  if (!(await verifyPassword(current, user.passHash))) {
    await recordFailure(db, key, now);
    return Response.json({ error: "Your current password is wrong." }, { status: 403 });
  }
  await clearThrottle(db, key);
  // Revokes every session minted before this instant — including this one.
  // Changing your password after a compromise must sign the attacker out,
  // and "signs you out everywhere" is the honest, expected trade.
  await updateUser(db, user.id, { passHash: await hashPassword(next), passwordChangedAt: new Date() });
  await logAction(db, {
    actorId: user.id,
    actorName: `${user.displayName} (${user.username})`,
    action: "user.self-password"
  });
  return Response.json({ ok: true, reauth: true });
}
