/**
 * Practice filing rollup on the Team Lead digest.
 *
 * Counts only — modules used, finding categories, killer rule frequency.
 * Never a person score or ranking (see digest.ts four rules).
 */
import type { PracticeFilingRollup } from "@/lib/digest/filingRollup";
import { SEVERITY_LABELS, type Severity } from "@/lib/audit/types";

const SEV_ORDER: Severity[] = ["S0", "S1", "S2", "S3", "S4"];

export function DigestFilingRollup({
  rollup,
  periodDays
}: {
  rollup: PracticeFilingRollup;
  periodDays: number;
}) {
  if (rollup.notesTotal === 0) return null;

  const stampedShare =
    rollup.notesWithSnapshot === 0
      ? null
      : `${rollup.notesWithKillers} of ${rollup.notesWithSnapshot}`;

  return (
    <section className="mt-6" aria-labelledby="filing-rollup-heading">
      <h2 id="filing-rollup-heading" className="section-title">
        Filing rollup
      </h2>
      <p className="mb-2 max-w-3xl text-xs text-slate-600">
        Practice totals for the last {periodDays} days — which modules were filed and which finding
        categories showed up. Use this to see whether finish checks are changing what leaves the
        tool. Not a score, and never broken out by person.
      </p>

      <div className="card space-y-4">
        <p className="text-sm text-slate-800">
          {rollup.notesWithSnapshot} of {rollup.notesTotal}{" "}
          {rollup.notesTotal === 1 ? "note" : "notes"} contributed structured filing data
          {rollup.notesWithSnapshot < rollup.notesTotal
            ? " (older filings recover modules and severity from the frozen audit when possible)"
            : ""}
          .
          {stampedShare ? (
            <>
              {" "}
              Killers present at file time: {stampedShare} stamped{" "}
              {rollup.notesWithSnapshot === 1 ? "note" : "notes"}.
            </>
          ) : null}
        </p>

        {rollup.modules.length > 0 && (
          <div>
            <h3 className="eyebrow">Modules filed</h3>
            <ul className="mt-1.5 columns-1 gap-x-6 sm:columns-2">
              {rollup.modules.map((m) => (
                <li key={m.id} className="break-inside-avoid text-sm text-slate-800">
                  {m.title}{" "}
                  <span className="text-slate-500">
                    — {m.notes} {m.notes === 1 ? "note" : "notes"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rollup.categories.length > 0 && (
          <div>
            <h3 className="eyebrow">Finding categories</h3>
            <ul className="mt-1.5 space-y-0.5">
              {rollup.categories.map((c) => (
                <li key={c.category} className="text-sm text-slate-800">
                  {c.label}{" "}
                  <span className="text-slate-500">
                    — {c.findings} {c.findings === 1 ? "finding" : "findings"} across {c.notes}{" "}
                    {c.notes === 1 ? "note" : "notes"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rollup.killers.length > 0 && (
          <div>
            <h3 className="eyebrow">Litigation / wrong-site items at file time</h3>
            <ul className="mt-1.5 space-y-0.5">
              {rollup.killers.map((k) => (
                <li key={k.ruleId} className="text-sm text-slate-800">
                  {k.label}{" "}
                  <span className="text-slate-500">
                    — {k.notes} {k.notes === 1 ? "note" : "notes"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="eyebrow">Severity at file time</h3>          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-800">
            {SEV_ORDER.map((s) => {
              const findings = rollup.severityFindings[s];
              const notes = rollup.severityNotes[s];
              if (findings === 0 && notes === 0) return null;
              return (
                <li key={s}>
                  {SEVERITY_LABELS[s]}: {findings} across {notes}{" "}
                  {notes === 1 ? "note" : "notes"}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
