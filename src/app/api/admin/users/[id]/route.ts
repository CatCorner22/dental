import { isClinicalRole, type ClinicalRole } from "@/lib/auth/clinicalRoles";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { deleteUser, getUserById, mutateAdminGuarded, updateUser } from "@/lib/db/repo/users";
import { getOffice, setOfficesForUser } from "@/lib/db/repo/offices";
import { ownerDraftCount } from "@/lib/db/repo/drafts";
import { submissionCountByUser } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";
import {
  canAssignRole,
  canDeactivateOrDelete,
  canDeleteUser,
  canEditContact,
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

  // Read the body BEFORE the self-target guard, because one narrow field is
  // allowed on your own account and the guard cannot tell without looking.
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;

  // Your OWN office assignments, and nothing else in the same request.
  //
  // An assignment confers no authority — it only orders the note picker — so
  // refusing it protects nothing while leaving a practice manager unable to
  // record their own rota, which is a rota they of all people know. Scoped by
  // an exact key count so an officeIds field cannot be used to smuggle a role
  // change past the guard below.
  const selfOfficesOnly =
    id === guard.user.id &&
    Object.keys(b).length === 1 &&
    Object.prototype.hasOwnProperty.call(b, "officeIds");

  // Defence in depth. canActOn already refuses a self-target today, but only
  // because no practice role's ceiling equals its own rank — a property of the
  // MANAGE_CEILING table, not of this route. Raise any ceiling and self-service
  // promotion appears here silently. Say it out loud instead.
  if (id === guard.user.id && !selfOfficesOnly) {
    return Response.json(
      { error: "You cannot use this screen on your own account." },
      { status: 403 }
    );
  }

  // Authority is checked against the TARGET's current role, so no one can act
  // on an account more powerful than they are allowed to touch. Skipped for the
  // self-offices carve-out: canDeactivateOrDelete is false against your own
  // rank by construction, so it would undo the exemption immediately.
  if (!selfOfficesOnly && !canDeactivateOrDelete(guard.user.role, target.role)) {
    return Response.json(
      { error: `You cannot modify a ${ROLE_LABEL[target.role]} account.` },
      { status: 403 }
    );
  }
  const patch: {
    displayName?: string;
    role?: Role;
    active?: boolean;
    clinicalRole?: ClinicalRole;
    email?: string | null;
    groupEmail?: string | null;
    emailChangedAt?: Date;
    emailChangedBy?: string;
  } = {};
  // Which offices this person works at. A SET, because staff rotate and most
  // people genuinely belong to several.
  //
  // Deliberately NOT gated on canEditContact: it is not contact data, it grants
  // no access, and it is not a takeover vector. It sits with displayName, which
  // anyone who can manage the account may set. Nothing anywhere may read it as
  // a permission — every office stays selectable by everyone on every note.
  //
  // Applied AFTER the account update succeeds, so a rejected patch cannot leave
  // the assignments changed.
  let officeIds: string[] | null = null;
  if (b.officeIds !== undefined) {
    if (!Array.isArray(b.officeIds) || b.officeIds.some((x) => typeof x !== "string")) {
      return Response.json({ error: "Invalid office list." }, { status: 400 });
    }
    const ids = [...new Set(b.officeIds as string[])].filter(Boolean);
    if (ids.length > 50) {
      return Response.json({ error: "Too many offices." }, { status: 400 });
    }
    for (const id of ids) {
      if (!(await getOffice(db, id))) {
        return Response.json(
          { error: "That office is not on the practice's list." },
          { status: 400 }
        );
      }
    }
    officeIds = ids;
  }
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
  // Scope of practice. Gated on canActOn like the other account fields — it is
  // a statement about what someone may write in a clinical record, so it is not
  // self-service the way an office assignment is. Nobody may set their own.
  if (b.clinicalRole !== undefined) {
    if (!isClinicalRole(b.clinicalRole)) {
      return Response.json({ error: "Unknown clinical role." }, { status: 400 });
    }
    patch.clinicalRole = b.clinicalRole;
  }
  // Repointing an address is an account-takeover primitive, not an edit: mail
  // yourself the reset link and you can sign Smile Notes as that clinician.
  // Held one tier above the reset-link power on purpose.
  if (typeof b.email === "string" || typeof b.groupEmail === "string") {
    if (!canEditContact(guard.user.role, target.role)) {
      return Response.json(
        {
          error:
            "Only a Hierarchy Manager or Smile Notes Developer can change the email on an existing account."
        },
        { status: 403 }
      );
    }
    if (typeof b.email === "string") patch.email = normalizeEmail(b.email) || null;
    if (typeof b.groupEmail === "string") patch.groupEmail = normalizeEmail(b.groupEmail) || null;
    // Stamp WHO moved the delivery address, so the reset-link route can refuse
    // to let the same person also mail the link there. Only stamped when the
    // address genuinely changes — re-saving the same value must not lock a
    // manager out of a reset they had every right to send.
    if (patch.email !== undefined && (patch.email ?? "") !== (target.email ?? "")) {
      patch.emailChangedAt = new Date();
      patch.emailChangedBy = guard.user.id;
    }
  }
  // Office assignments live in their own table and are applied below rather
  // than through `patch`, so an assignment-only request leaves `patch` empty
  // and would otherwise be refused as "nothing to update" — which is how the
  // one field a person may set on their own account became unreachable.
  if (Object.keys(patch).length === 0 && officeIds === null) {
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
    // Skip a no-op UPDATE when the request only carried assignments.
    if (Object.keys(patch).length > 0) await updateUser(db, id, patch);
  }
  // Only once the account update has actually landed — including the
  // last-admin guard above, which can refuse it.
  if (officeIds !== null) await setOfficesForUser(db, id, officeIds);
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.update",
    target: target.username,
    detail: JSON.stringify(officeIds === null ? patch : { ...patch, officeIds })
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

  // Defence in depth. canActOn already refuses a self-target today, but only
  // because no practice role's ceiling equals its own rank — a property of the
  // MANAGE_CEILING table, not of this route. Raise any ceiling and self-service
  // promotion appears here silently. Say it out loud instead.
  if (id === guard.user.id) {
    return Response.json(
      { error: "You cannot use this screen on your own account." },
      { status: 403 }
    );
  }
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
