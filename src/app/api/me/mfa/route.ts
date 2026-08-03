import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { generateMfaSecret, mfaEnrollmentUri, verifyMfaCode } from "@/lib/auth/totp";
import { checkThrottle, clearThrottle, passwordCheckKey, recordFailure } from "@/lib/auth/throttle";

export const runtime = "nodejs";

// Self-service TOTP enrollment, in three explicit steps:
//
//   start   → a new secret is stored DISABLED and returned once, with the
//             otpauth:// URI. Starting again replaces it — an unconfirmed
//             secret is not a factor yet, just a proposal.
//   confirm → the user proves the authenticator actually has the secret by
//             producing a valid code. Only then does MFA turn on. Enabling a
//             factor nobody's device holds is how people lock themselves out.
//   disable → requires a valid CURRENT code, so a walked-away-unlocked
//             session cannot quietly strip the account's second factor. A
//             lost device is the one case this cannot serve, and that path
//             goes through a Smile Notes Developer (admin MFA reset), which
//             is a named, logged, two-person event.
//
// Any signed-in role may protect their own account, read-only included.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = parsed.value.action;
  const code = typeof parsed.value.code === "string" ? parsed.value.code.trim() : "";

  const db = await getDb();
  const user = await getUserById(db, guard.user.id);
  if (!user) return Response.json({ error: "Not found." }, { status: 404 });

  // A code check is an oracle; it gets the same per-account meter the
  // password-change oracle uses.
  const key = passwordCheckKey(user.id);
  const now = new Date();

  if (action === "start") {
    const secret = generateMfaSecret();
    await updateUser(db, user.id, { mfaSecret: secret, mfaEnabled: false });
    return Response.json({
      secret,
      uri: mfaEnrollmentUri(user.username, secret),
      note: "Add this to your authenticator app, then confirm with a current code. MFA is not on until you confirm."
    });
  }

  if (action === "confirm" || action === "disable") {
    const throttled = await checkThrottle(db, key, now);
    if (throttled.locked) {
      return Response.json(
        { error: `Too many attempts. Try again in ${throttled.retryAfterSec} seconds.` },
        { status: 429, headers: { "retry-after": String(throttled.retryAfterSec) } }
      );
    }
    if (!user.mfaSecret) {
      return Response.json({ error: "No enrollment in progress. Start again." }, { status: 409 });
    }
    if (!verifyMfaCode(user.username, user.mfaSecret, code)) {
      await recordFailure(db, key, now);
      return Response.json({ error: "That code is not valid. Codes change every 30 seconds — check the app and try again." }, { status: 422 });
    }
    await clearThrottle(db, key);

    if (action === "confirm") {
      await updateUser(db, user.id, { mfaEnabled: true });
      await logAction(db, {
        actorId: user.id,
        actorName: `${user.displayName} (${user.username})`,
        action: "auth.mfa-enabled",
        target: user.username,
        detail: null
      });
      return Response.json({ enabled: true });
    }

    await updateUser(db, user.id, { mfaEnabled: false, mfaSecret: null });
    await logAction(db, {
      actorId: user.id,
      actorName: `${user.displayName} (${user.username})`,
      action: "auth.mfa-disabled",
      target: user.username,
      detail: null
    });
    return Response.json({ enabled: false });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
