import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { RESET_LINK_DEAD_MESSAGE } from "@/lib/auth/resetDeadLink";
import { hashResetToken } from "@/lib/auth/resetToken";
import { findLiveResetToken, redeemResetToken } from "@/lib/db/repo/resetTokens";
import { getUserById } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { clearThrottle, passwordCheckKey } from "@/lib/auth/throttle";

export const runtime = "nodejs";

// Redeem a reset link. Deliberately UNAUTHENTICATED — the whole point is that
// someone locked out of their account can use it. The token is the credential.
export async function POST(req: Request): Promise<Response> {
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const token = typeof b.token === "string" ? b.token : "";
  const password = typeof b.password === "string" ? b.password : "";
  // One deliberately vague message for every token failure — expired, already
  // used, or never existed. Distinguishing them would let someone probe which
  // tokens are real. Shared with ResetForm's terminal panel — see resetDeadLink.ts.
  const INVALID = RESET_LINK_DEAD_MESSAGE;
  if (!token) return Response.json({ error: INVALID }, { status: 400 });

  const pwError = passwordPolicyError(password);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });

  const db = await getDb();
  const now = new Date();
  const row = await findLiveResetToken(db, hashResetToken(token), now);
  if (!row) return Response.json({ error: INVALID }, { status: 400 });

  const user = await getUserById(db, row.userId);
  if (!user || !user.active) return Response.json({ error: INVALID }, { status: 400 });

  // Consuming the token and setting the password happen in one transaction
  // guarded on the token still being unused, so two simultaneous redemptions of
  // a forwarded link cannot both win.
  const redeemed = await redeemResetToken(db, row.id, row.userId, await hashPassword(password), now);
  if (!redeemed) return Response.json({ error: INVALID }, { status: 400 });

  // A fresh password should not leave the account still serving a lockout from
  // failed attempts before the reset.
  await clearThrottle(db, passwordCheckKey(user.id));
  await logAction(db, {
    actorId: user.id,
    actorName: `${user.displayName} (${user.username})`,
    action: "password.reset-completed",
    target: user.username
  });
  return Response.json({ ok: true });
}
