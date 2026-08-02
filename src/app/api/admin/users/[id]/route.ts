import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { deleteUser, getUserById, mutateAdminGuarded, updateUser } from "@/lib/db/repo/users";
import { ownerDraftCount } from "@/lib/db/repo/drafts";
import { submissionCountByUser } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";
import {
  canAssignRole,
  canDeactivateOrDelete,
  canDeleteUser,
  ROLE_LABEL,
  type Role
} from "@/lib/auth/roles";
import { emailPolicyError, normalizeEmail } from "@/lib/auth/emails";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const ROLES: Role[] = ["readonly", "user", "lead", "manager", "admin"];

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });

  // Authority is checked against the TARGET's current role, so no one can act
  // on an account more powerful than they are allowed to touch.
  if (!canDeactivateOrDelete(guard.user.role, target.role)) {
    return Response.json(
      { error: `You cannot modify a ${ROLE_LABEL[target.role]} account.` },
      { status: 403 }
    );
  }

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const patch: {
    displayName?: string;
    role?: Role;
    active?: boolean;
    email?: string | null;
    groupEmail?: string | null;
  } = {};
  if (typeof b.displayName === "string") {
    const cleanName = sanitizeIdentity(b.displayName);
    if (cleanName) patch.displayName = cleanName;
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role as Role)) {
      return Response.json({ error: "Unknown role." }, { status: 400 });
    }
    const newRole = b.role as Role;
    // Promotion is the sharpest edge here: without this an actor could raise
    // someone (or be tricked into raising someone) above their own ceiling.
    if (newRole !== target.role && !canAssignRole(guard.user.role, target.role, newRole)) {
      return Response.json(
        { error: `You cannot set a role of ${ROLE_LABEL[newRole]}.` },
        { status: 403 }
      );
    }
    patch.role = newRole;
  }
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.email === "string") patch.email = normalizeEmail(b.email) || null;
  if (typeof b.groupEmail === "string") patch.groupEmail = normalizeEmail(b.groupEmail) || null;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing valid to update." }, { status: 400 });
  }

  // The two-email rule is checked against the role the account will HAVE after
  // this patch, using the addresses it will have — otherwise promoting someone
  // to Hierarchy Manager could slip past it.
  const effectiveRole = patch.role ?? target.role;
  const emailError = emailPolicyError(effectiveRole, {
    email: patch.email !== undefined ? patch.email : target.email,
    groupEmail: patch.groupEmail !== undefined ? patch.groupEmail : target.groupEmail
  });
  if (emailError) return Response.json({ error: emailError }, { status: 400 });

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
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.update",
    target: target.username,
    detail: JSON.stringify(patch)
  });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });
  if (!canDeleteUser(guard.user.role, target.role)) {
    return Response.json(
      { error: `You cannot delete a ${ROLE_LABEL[target.role]} account. Deactivate it instead.` },
      { status: 403 }
    );
  }
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
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.delete",
    target: target.username
  });
  return new Response(null, { status: 204 });
}
