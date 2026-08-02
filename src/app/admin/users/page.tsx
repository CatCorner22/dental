import { redirect } from "next/navigation";
import { canManageUsers, canSendResetLink } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { listUsers } from "@/lib/db/repo/users";
import { UserAdmin } from "@/components/admin/UserAdmin";

export const runtime = "nodejs";
export const metadata = { title: "User admin" };

export default async function AdminUsersPage() {
  const user = await freshSessionUser(); // fresh role — a demoted admin loses this page NOW
  if (!user) redirect("/login");
  if (!canManageUsers(user.role)) redirect("/");
  const db = await getDb();
  const users = await listUsers(db);
  return (
    <UserAdmin
      selfId={user.id}
      selfRole={user.role}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        active: u.active,
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
