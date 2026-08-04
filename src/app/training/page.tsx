import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { TRAINING_SCENARIOS } from "@/lib/training/scenarios";
import { TrainingArena } from "@/components/training/TrainingArena";

export const runtime = "nodejs";
export const metadata = { title: "Training arena" };

export default async function TrainingPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "user")) redirect("/");
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="page-title mb-1">Training arena</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Three-minute practice cases with planted defects — the same defects the audit catches in
        real notes, checked by the same engine, worth a double bounty the first time each one
        comes back clean.
      </p>
      <TrainingArena scenarios={TRAINING_SCENARIOS} />
    </div>
  );
}
