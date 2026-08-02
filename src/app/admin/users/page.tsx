import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listUsers } from "@/lib/db/repo/users";
import { UserAdmin } from "@/components/admin/UserAdmin";

export const runtime = "nodejs";
export const metadata = { title: "User admin — Dental Note Builder" };

export default async function AdminUsersPage() {
  const session = await auth();
  if (session!.user.role !== "admin") redirect("/");
  const db = await getDb();
  const users = await listUsers(db);
  return (
    <UserAdmin
      selfId={session!.user.id}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        active: u.active
      }))}
    />
  );
}
