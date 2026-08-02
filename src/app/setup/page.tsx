import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countUsers } from "@/lib/db/repo/users";
import { SetupForm } from "@/components/auth/SetupForm";

export const metadata = { title: "Set up — Smile Notes" };

export default async function SetupPage() {
  const db = await getDb();
  if ((await countUsers(db)) > 0) redirect("/login");
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-2 text-2xl font-bold">Welcome — create the first admin</h1>
      <p className="mb-6 text-sm text-slate-600">
        This one-time step creates the administrator account. The admin can then add the rest of
        the team and assign roles.
      </p>
      <SetupForm />
    </div>
  );
}
