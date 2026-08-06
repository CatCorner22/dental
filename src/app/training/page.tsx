import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { TRAINING_SCENARIOS } from "@/lib/training/scenarios";
import { TrainingArena } from "@/components/training/TrainingArena";
import { SYNTHETIC_TRAINING_NOTES } from "@/lib/training/synthetic-notes";
import { StandardizeDrill } from "@/components/training/StandardizeDrill";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

export const runtime = "nodejs";
export const metadata = { title: "Training arena" };

export default async function TrainingPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "user")) redirect("/");
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2 flex items-center gap-3">
        <Character id="sparkle" size="md" />
        <div>
          <h1 className="page-title">Training arena</h1>
          <p className="text-sm text-slate-600">{sparkleLine("training", daySeed(new Date()))}</p>
        </div>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Three-minute practice cases with planted defects — the same defects the audit catches in
        real notes, checked by the same engine, worth a double bounty the first time each one
        comes back clean.
      </p>
      <TrainingArena scenarios={TRAINING_SCENARIOS} />
      <StandardizeDrill notes={[...SYNTHETIC_TRAINING_NOTES]} />
    </div>
  );
}
