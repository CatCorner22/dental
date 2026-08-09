import { isClinicalRole } from "@/lib/auth/clinicalRoles";
import { redirect } from "next/navigation";
import { mfaFeatureEnabled } from "@/lib/auth/mfaFeature";
import { canManageUsers, canSendResetLink } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { listUsers } from "@/lib/db/repo/users";
import { listActiveOffices, officeIdsForUser } from "@/lib/db/repo/offices";
import { UserAdmin } from "@/components/admin/UserAdmin";

export const runtime = "nodejs";
export const metadata = { title: "User admin" };

export default async function AdminUsersPage() {
  const user = await freshSessionUser(); // fresh role — a demoted admin loses this page NOW
  if (!user) redirect("/login");
  if (!canManageUsers(user.role)) redirect("/");
  const db = await getDb();
  const users = await listUsers(db);
  const offices = await listActiveOffices(db);
  // One query per user. The practice has tens of accounts, not thousands, and
  // a join here would need hand-rolled grouping for no measurable gain.
  const assignments = new Map(
    await Promise.all(
      users.map(async (u) => [u.id, await officeIdsForUser(db, u.id)] as const)
    )
  );
  return (
    <UserAdmin
      selfId={user.id}
      selfRole={user.role}
      mfaFeatureOn={mfaFeatureEnabled()}
      offices={offices.map((o) => ({ id: o.id, name: o.name }))}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        active: u.active,
        officeIds: assignments.get(u.id) ?? [],
        clinicalRole: isClinicalRole(u.clinicalRole) ? u.clinicalRole : "unset",
        // A BOOLEAN, never the secret. The screen only needs to know whether
        // there is a factor to clear; a half-finished enrollment (secret
        // stored, not yet confirmed) counts, because it too blocks a clean
        // re-enrollment after a lost device.
        mfaArmed: u.mfaEnabled || u.mfaSecret !== null,
        // Mirrors the rule in GET /api/admin/users: an address is the delivery
        // target for an account takeover, so it is only sent to a viewer who is
        // allowed to mail a reset link there anyway.
        ...(canSendResetLink(user.role, u.role)
          ? { email: u.email, groupEmail: u.groupEmail }
          : {})
      }))}
    />
  );
}
