import { redirect } from "next/navigation";
import { meetsRole } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { WordMap } from "@/components/standardize/WordMap";
import { buildWordMap, wordMapCounts } from "@/lib/standardize/wordMap";

export const runtime = "nodejs";
export const metadata = { title: "Word map" };

// The practice's standard wording, built from the same tables the audit
// enforces — so this reference can never drift from the rule it documents.
//
// It used to sit at the bottom of the dashboard, where it was the tallest block
// on the busiest screen: several hundred pixels of accordion under the place
// people go to start work. It is reference material, and it now lives with the
// rest of the reference material.
//
// Read-only accounts are excluded: they cannot author a note, so the vocabulary
// is not theirs to apply.
export default async function WordMapPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "user")) redirect("/reference/templates");

  const groups = buildWordMap();
  const counts = wordMapCounts(groups);

  return (
    <section>
      <h1 className="page-title mb-1">Word map</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        The wording this practice standardizes on. Anything marked{" "}
        <span className="rounded bg-amber-100 px-1 text-xs text-amber-900">your call</span> needs a
        clinical judgement, so the tool flags it instead of changing it.
      </p>
      <WordMap groups={groups} total={counts.total} auto={counts.auto} />
    </section>
  );
}
