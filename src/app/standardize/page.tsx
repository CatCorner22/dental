import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { Standardizer } from "@/components/standardize/Standardizer";

export const runtime = "nodejs";
export const metadata = { title: "Standardize a note" };

export default async function StandardizePage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  // A read-only account cannot author a note, so it has nothing to standardize.
  if (!meetsRole(user.role, "user")) redirect("/");
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Standardize a note</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Paste what you would normally type, press one button, and get it back in the
        practice&rsquo;s standard wording — ready to paste into Curve Hero. Every change is listed
        so you can see exactly what happened, and anything that needs a clinical judgement is handed
        back to you rather than guessed.
      </p>
      <Standardizer />
    </div>
  );
}
