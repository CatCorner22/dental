import {
  DRIFT_THRESHOLDS,
  driftVerdict,
  fabricationRate,
  summarize,
  type DriftEvent
} from "@/lib/assist/drift";

// The AI's own error signal, shown to the people who can act on it.
//
// Server component: this is a read of an immutable log, and there is nothing to
// interact with. Deliberately placed at the TOP of the audit page rather than in
// a separate screen nobody opens — a drift monitor that has to be sought out is a
// drift monitor that gets checked the week after it mattered.
//
// The tone rule this follows is the one the rest of the app follows: state WHAT
// was found, WHY the line stops, HOW to move. No alarm language for a number that
// means "staff are wasting clicks", and no soothing language for one that means
// the model is trying to invent clinical findings.

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const LEVEL_STYLE = {
  quiet: { chip: "border-slate-300 bg-slate-100 text-slate-700", icon: "○", label: "Steady" },
  watch: { chip: "border-amber-300 bg-amber-100 text-amber-900", icon: "◆", label: "Worth a look" },
  investigate: { chip: "border-red-300 bg-red-100 text-red-900", icon: "▲", label: "Investigate" }
} as const;

// Codes a reader should not have to decode from a symbol. Only the ones the
// verifier can actually emit; anything unmapped falls back to its own id, which
// is honest rather than blank.
const CODE_LABEL: Record<string, string> = {
  "content-invented": "Tried to add a claim the note did not contain",
  "attribution-added": "Turned an examiner's finding into a patient report",
  "attribution-dropped": "Dropped a patient attribution",
  "digits-changed": "Changed a number",
  "negation-changed": "Added or removed a negation",
  "negation-scope-changed": "Moved a negation onto a different finding",
  "site-changed": "Changed laterality or anatomical site",
  "surfaces-changed": "Changed a surface designator",
  "units-changed": "Changed a measurement unit",
  "drugs-changed": "Changed a drug mention",
  "teeth-changed": "Changed a primary-tooth letter",
  "content-shrunk": "Dropped content instead of standardizing it",
  "not-questions": "Asserted a fact in a question list",
  "output-degenerate": "Returned an empty note, a code fence, or chat preamble"
};

export function DriftPanel({ events }: { events: DriftEvent[] }) {
  const window = summarize(events);
  const answered = window.accepted + window.refused;
  const verdict = driftVerdict(window);
  const style = LEVEL_STYLE[verdict.level];

  if (events.length === 0) {
    return (
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold">AI assist — drift monitor</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          No AI calls recorded. Either assist is switched off for this deployment, which is the
          default, or nobody has used it yet. Nothing here is required for the app to work.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">AI assist — drift monitor</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.chip}`}
        >
          {/* Colour is never the only signal — icon and word carry it too. */}
          <span aria-hidden>{style.icon}</span>
          {style.label}
        </span>
      </div>
      <p className="mb-3 max-w-3xl text-sm text-slate-700">{verdict.reason}</p>
      <p className="mb-4 max-w-3xl text-xs text-slate-500">
        Every AI call is judged by the deterministic verifier before a human sees it. A refusal
        means the rails held — nothing unsafe reached a note. What this panel is for is the{" "}
        <strong>trend</strong>: one refusal is an event, and a rising share of them is a model that
        has changed behind its version name. The log holds no note text, only which check refused.
      </p>

      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Answered", String(answered), "calls the model returned"],
          ["Accepted", String(window.accepted), "passed the verifier"],
          ["Refused", String(window.refused), "rejected before anyone saw them"],
          [
            "Refusal rate",
            pct(window.refusalRate),
            `bar is ${pct(DRIFT_THRESHOLDS.refusalRate)}`
          ],
          [
            "Fabrication rate",
            pct(fabricationRate(window)),
            `bar is ${pct(DRIFT_THRESHOLDS.fabricationRate)}`
          ]
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-xl font-bold text-slate-900">{value}</dd>
            <dd className="text-xs text-slate-500">{hint}</dd>
          </div>
        ))}
      </dl>

      {(window.phiBlocked > 0 || window.errors > 0) && (
        <p className="mb-4 text-xs text-slate-600">
          Also in this window: <strong>{window.phiBlocked}</strong> call
          {window.phiBlocked === 1 ? "" : "s"} never made because the text was not de-identified
          (a fact about what was typed, not about the model, so it is kept out of the rate above),
          and <strong>{window.errors}</strong> provider failure
          {window.errors === 1 ? "" : "s"}.
        </p>
      )}

      {window.byCode.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 text-sm font-semibold text-slate-800">Why calls were refused</h3>
          <ul className="space-y-1">
            {window.byCode.slice(0, 8).map((c) => (
              <li key={c.code} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-8 font-bold tabular-nums text-slate-900">{c.count}</span>
                <span className="text-slate-700">{CODE_LABEL[c.code] ?? c.code}</span>
                {/* The id only when it adds something. PHI rule ids arrive here
                    too and have no plain-English label, so printing both showed
                    the same string twice. */}
                {CODE_LABEL[c.code] && (
                  <span className="font-mono text-xs text-slate-400">{c.code}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {window.byModel.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-slate-800">By model</h3>
          <p className="mb-1.5 max-w-3xl text-xs text-slate-500">
            A model name is a pointer, not a version — what answers to it can change without
            notice. This is the row to read when a rate moves and nothing in the practice did.
          </p>
          <ul className="space-y-1">
            {window.byModel.map((m) => (
              <li key={m.model} className="text-sm">
                <span className="font-mono text-xs text-slate-700">{m.model}</span>
                <span className="text-slate-600">
                  {" "}
                  — {m.answered} answered, {m.refused} refused ({pct(m.refusalRate)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
