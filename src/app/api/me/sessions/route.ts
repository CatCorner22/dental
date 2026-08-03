import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";

export const runtime = "nodejs";

// End every session for the CALLER's own account.
//
// Written for the shared operatory machine, which is the realistic way a
// dental practice loses control of an identity: someone signs in at chairside,
// gets called away, and the next person to touch that keyboard is documenting
// as them — into a record whose attribution is frozen forever.
//
// Deliberately takes no user id. This acts on the session making the request
// and nothing else, so it needs no authority check beyond "is signed in" and
// cannot be aimed at a colleague. Forcing someone else out is a separate
// power that already exists (deactivate, or reset by link).
//
// requireAck:false — a user who has not yet acknowledged the notice may still
// need to kill a session they left running somewhere else.
export async function DELETE(): Promise<Response> {
  const guard = await requireRole("readonly", { requireAck: false });
  if (!guard.ok) return guard.response;
  const db = await getDb();

  // This also ends the session that asked. That is intentional and the UI says
  // so: "all devices" that quietly excluded the current one would be a
  // half-measure exactly when someone is worried about who is signed in.
  await updateUser(db, guard.user.id, { sessionsRevokedAt: new Date() });
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "auth.revoke-sessions",
    target: guard.user.username
  });
  return Response.json({ ok: true });
}
