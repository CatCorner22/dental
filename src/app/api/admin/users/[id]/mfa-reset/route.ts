import { requireRole } from "@/lib/auth/guards";
import { canSetPasswordDirectly } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// The lost-device path: a Smile Notes Developer clears a user's second
// factor so they can sign in with password alone and re-enroll.
//
// Same authority bar as setting a password directly, and for the same reason:
// stripping a second factor is credential-adjacent power. It is a named,
// logged event — the person whose factor was removed can see who did it and
// when in the audit log, which is what makes the emergency path safe to have.
export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  if (!canSetPasswordDirectly(guard.user.role)) {
    return Response.json(
      { error: "Only a Smile Notes Developer can reset a user's two-factor authentication." },
      { status: 403 }
    );
  }
  const { id } = await params;
  // Never self. Turning MFA off normally DEMANDS a current code, precisely so
  // a walked-away-unlocked screen cannot strip the account's second factor —
  // and this route with a self-target was a code-free bypass of that exact
  // control on the most powerful account in the system. Another Developer can
  // still reset it, which also makes the audit trail's "who did it" a second
  // person by construction.
  if (id === guard.user.id) {
    return Response.json(
      {
        error:
          "You cannot reset your own two-factor authentication from here. Turn it off with a current code in Account settings, or ask another Smile Notes Developer."
      },
      { status: 403 }
    );
  }
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });
  if (!target.mfaEnabled && !target.mfaSecret) {
    return Response.json({ error: "This account has no two-factor authentication to reset." }, { status: 409 });
  }
  await updateUser(db, id, { mfaEnabled: false, mfaSecret: null });
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.mfa-reset",
    target: target.username,
    detail: "second factor cleared; user must re-enroll"
  });
  return Response.json({ ok: true });
}
