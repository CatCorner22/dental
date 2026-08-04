import { redirect } from "next/navigation";
import Link from "next/link";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { canSubmitChangeRequest } from "@/lib/auth/roles";
import { GauntletForm } from "@/components/requests/GauntletForm";

export const runtime = "nodejs";
export const metadata = { title: "Data change request" };

export default async function RequestsPage() {
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  if (!canSubmitChangeRequest(user.role)) redirect("/");

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-1">Ask the Smile Notes Team for a data change</h1>
      <p className="mb-4 text-sm text-slate-600">
        Adding, removing, or changing a field is structural, not cosmetic — it reaches charts,
        recalls, medical alerts, claims, and every report. Treat this proposal as contaminated until
        it clears all five sterilization cycles.{" "}
        <Link className="font-semibold text-blue-700 underline" href="/reference/data-hygiene">
          Read the full Data Hygiene Guide
        </Link>
        .
      </p>
      <GauntletForm />
    </div>
  );
}
