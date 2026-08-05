"use client";

import { useMemo, useState } from "react";
import { advise } from "@/lib/advisor/advisor";
import { HelpTip } from "@/components/ui/HelpTip";
import { Byte } from "./Byte";

// BYTE'S PANEL — the advisor behind the glass.
//
// READ-ONLY BY ARCHITECTURE. This component receives text and renders advice;
// it has no setter for the note, no insert button, no write path of any kind.
// The one action it can offer — "ask the deep model" — is a callback the host
// screen wires to the EXISTING verified AI capabilities, which themselves only
// return questions and verified proposals through their own rails. Byte
// commands the whole stack; the stack keeps its cage; the note keeps its
// chain of custody.
//
// One piece of advice at a time, rotatable. A coach that says three things at
// once says nothing; the count of remaining tips is shown so nothing is
// hidden, and the reader chooses the pace.

export function ByteAdvisor({
  text,
  assistEnabled = false,
  onAskDeeper
}: {
  text: string;
  /** Wired by the host to the verified interrogate capability. Advice-only. */
  assistEnabled?: boolean;
  onAskDeeper?: () => void;
}) {
  const report = useMemo(() => advise(text), [text]);
  const [tipIndex, setTipIndex] = useState(0);
  const tip = report.advice[Math.min(tipIndex, Math.max(0, report.advice.length - 1))];
  const { gauges } = report;

  return (
    <section
      aria-label="Byte, the drafting advisor"
      className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-3 ring-1 ring-slate-200"
    >
      <div className="flex items-start gap-3">
        <Byte mood={report.mood} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-brand-navy">Byte</h3>
              <HelpTip label="What Byte does">
                Byte reads your draft on this device only. Advice cites a source. Byte never
                writes the note and never blocks filing — the audit panel owns stops.
              </HelpTip>
            </div>
            <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">
              advisor · reads only · never blocks
            </span>
          </div>

          {tip ? (
            <div className="relative mt-1 rounded-lg rounded-tl-none bg-white p-2.5 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-900">{tip.say}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{tip.why}</p>
              {tip.nextAction && (
                <p className="mt-1.5 rounded bg-brand-teal/10 px-2 py-1 text-xs font-medium text-brand-navy">
                  Next: {tip.nextAction}
                </p>
              )}
              <p className="mt-1.5 border-t border-slate-100 pt-1 text-[0.65rem] text-slate-400">
                Source: {tip.source}
              </p>
              {report.advice.length > 1 && (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-brand-blue underline decoration-dotted underline-offset-2"
                  onClick={() => setTipIndex((i) => (i + 1) % report.advice.length)}
                >
                  Next tip ({((tipIndex % report.advice.length) + 1)} of {report.advice.length})
                </button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {report.mood === "idle"
                ? "Start typing — I read teeth, doses, and findings as you go, and everything I say cites its source."
                : "Nothing to coach right now. Keep going."}
            </p>
          )}
        </div>
      </div>

      {/* THE DASHBOARD. Live numbers from the same analysis that sets the
          face. Severity colours are absent on purpose — these are gauges, not
          findings, and the audit panel owns the alarm palette. */}
      {gauges.words > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-center gap-1 text-slate-500">
                Read
                <HelpTip label="About read coverage" side="top">
                  {gauges.notes.read.why}
                  {gauges.notes.read.next ? ` ${gauges.notes.read.next}` : ""}
                </HelpTip>
              </span>
              <span className="font-bold tabular-nums text-brand-navy">
                {Math.round(gauges.readCoverage * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-teal transition-[width]"
                style={{ width: `${Math.round(gauges.readCoverage * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[0.65rem] leading-snug text-slate-500">{gauges.notes.read.why}</p>
          </div>

          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-center gap-1 text-slate-500">
                Facts
                <HelpTip label="About fact density" side="top">
                  {gauges.notes.density.why}
                </HelpTip>
              </span>
              <span className="font-bold tabular-nums text-brand-navy">{gauges.facts}</span>
            </div>
            <p className="mt-1 text-[0.65rem] text-slate-400">
              {gauges.density} per 100 words
            </p>
            <p className="mt-1 text-[0.65rem] leading-snug text-slate-500">{gauges.notes.density.why}</p>
          </div>

          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
            <span className="inline-flex items-center gap-1 text-slate-500">
              What a later reader asks
              <HelpTip label="About the four later-reader checks" side="top">
                {gauges.notes.pillars.why}
                {gauges.notes.pillars.next ? ` Next: ${gauges.notes.pillars.next}` : ""}
              </HelpTip>
            </span>
            {gauges.pillars.applicable ? (
              <ul className="mt-1 space-y-0.5 text-[0.65rem]">
                {(
                  [
                    ["Consent", gauges.pillars.consent],
                    ["Outcome", gauges.pillars.outcome],
                    ["Instructions", gauges.pillars.instructions],
                    ["Follow-up", gauges.pillars.followUp]
                  ] as const
                ).map(([label, present]) => (
                  <li key={label} className={present ? "text-teal-700" : "text-slate-400"}>
                    {present ? "✓" : "·"} {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[0.65rem] text-slate-400">Applies once treatment is documented.</p>
            )}
            <p className="mt-1 text-[0.65rem] leading-snug text-slate-500">{gauges.notes.pillars.why}</p>
          </div>

          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
            <span className="inline-flex items-center gap-1 text-slate-500">
              Anesthetic
              <HelpTip label="About anesthetic gauge" side="top">
                {gauges.notes.dose.why}
                {gauges.notes.dose.next ? ` ${gauges.notes.dose.next}` : ""}
              </HelpTip>
            </span>
            {gauges.dose ? (
              <>
                <p className="mt-0.5 text-[0.65rem] text-slate-600">
                  <span className="font-semibold tabular-nums">{gauges.dose.mg} mg</span> {gauges.dose.drug} of{" "}
                  {gauges.dose.maxMg} mg ceiling
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-blue transition-[width]"
                    style={{ width: `${Math.round(gauges.dose.fraction * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-[0.65rem] text-slate-400">
                Shows when a dose with a concentration appears.
              </p>
            )}
            <p className="mt-1 text-[0.65rem] leading-snug text-slate-500">{gauges.notes.dose.why}</p>
          </div>
        </div>
      )}

      {/* THE DEEP MODEL, on request — Byte's pioneer half. Routed through the
          host's verified AI stack: PHI gate before the wire, questions-only
          output, and nothing Byte or the model can write into the note. */}
      {assistEnabled && onAskDeeper && gauges.words > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <p className="text-[0.65rem] text-slate-500">
            Byte can also ask the deep model what this note leaves open — answers come back as
            questions, never as facts.
          </p>
          <button type="button" className="btn-secondary shrink-0 text-xs" onClick={onAskDeeper}>
            Think deeper
          </button>
        </div>
      )}
    </section>
  );
}
