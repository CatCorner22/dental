import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { deleteUser, getUserById, mutateAdminGuarded, updateUser } from "@/lib/db/repo/users";
import { ownerDraftCount } from "@/lib/db/repo/drafts";
import { submissionCountByUser } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import type { Role } from "@/lib/auth/roles";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const ROLES: Role[] = ["readonly", "user", "admin"];

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });

  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const patch: { displayName?: string; role?: Role; active?: boolean } = {};
  if (typeof b.displayName === "string" && b.displayName.trim()) patch.displayName = b.displayName.trim();
  if (ROLES.includes(b.role as Role)) patch.role = b.role as Role;
  if (typeof b.active === "boolean") patch.active = b.active;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing valid to update." }, { status: 400 });
  }

  // Never leave the system with no way in. The guard and the update run in
  // one serialized transaction, so two requests that each demote a different
  // admin cannot both pass the count check.
  const losingAdmin =
    (patch.role !== undefined && patch.role !== "admin" && target.role === "admin") ||
    (patch.active === false && target.role === "admin");
  if (losingAdmin) {
    if (!(await mutateAdminGuarded(db, id, { kind: "update", patch }))) {
      return Response.json({ error: "This is the last active admin." }, { status: 409 });
    }
  } else {
    await updateUser(db, id, patch);
  }
  await logAction(db, { actorId: guard.user.id, action: "user.update", target: target.username, detail: JSON.stringify(patch) });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });
  if ((await ownerDraftCount(db, id)) > 0) {
    return Response.json(
      { error: "This user still owns drafts. Transfer them to another user first." },
      { status: 409 }
    );
  }
  if ((await submissionCountByUser(db, id)) > 0) {
    return Response.json(
      { error: "This user has submission history, which must survive. Deactivate the account instead." },
      { status: 409 }
    );
  }
  if (target.role === "admin") {
    if (!(await mutateAdminGuarded(db, id, { kind: "delete" }))) {
      return Response.json({ error: "This is the last active admin." }, { status: 409 });
    }
  } else {
    await deleteUser(db, id);
  }
  await logAction(db, { actorId: guard.user.id, action: "user.delete", target: target.username });
  return new Response(null, { status: 204 });
}
