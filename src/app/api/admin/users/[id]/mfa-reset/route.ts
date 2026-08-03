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
