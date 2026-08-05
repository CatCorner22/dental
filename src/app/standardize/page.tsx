import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { getAssistConfig } from "@/lib/assist/service";
import { Standardizer } from "@/components/standardize/Standardizer";
import { edrProductName } from "@/lib/edr/product";

export const runtime = "nodejs";
export const metadata = { title: "Standardize a note" };

export default async function StandardizePage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  // A read-only account cannot author a note, so it has nothing to standardize.
  if (!meetsRole(user.role, "user")) redirect("/");
  const edrName = edrProductName();
  return (
    <div>
      <h1 className="page-title mb-1">Standardize a note</h1>
      <p className="mb-1 max-w-3xl text-sm text-slate-600">
        Paste what you would normally type and work the queue: the tool proposes, you decide.
        Every change is accepted by you item by item, everything it catches is fixed or explained
        on the record, and the note unlocks when the queue is clear — ready to paste into{" "}
        {edrName}.
      </p>
      <p className="mb-4 max-w-3xl text-xs text-slate-500">
        Why the queue exists: this note is the legal record of the visit. A reader three years
        from now — a colleague, an insurer, an attorney — gets only what you write today. The
        minute you spend here is the cheapest that minute will ever be.
      </p>
      <Standardizer
        assistEnabled={getAssistConfig().enabled}
        clinicalRole={user.clinicalRole}
      />
    </div>
  );
}
