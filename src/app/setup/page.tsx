import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countUsers } from "@/lib/db/repo/users";
import { SetupForm } from "@/components/auth/SetupForm";
import { BrandMark } from "@/components/shell/BrandMark";
import { PRIVACY_POLICY } from "@/lib/brand";

export const metadata = { title: "Set up" };

export default async function SetupPage() {
  const db = await getDb();
  if ((await countUsers(db)) > 0) redirect("/login");
  return (
    <div className="mx-auto max-w-md py-12">
      <p className="mb-3">
        <BrandMark size="lg" />
      </p>
      <h1 className="page-title mb-2">Create the first Smile Notes Developer</h1>
      <p className="mb-6 text-sm text-slate-600">
        This one-time step creates the account that can do everything. From there it adds
        Hierarchy Managers, who add Team Leads, who add the rest of the team.
      </p>
      <SetupForm />
      <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        {PRIVACY_POLICY}
      </p>
    </div>
  );
}
