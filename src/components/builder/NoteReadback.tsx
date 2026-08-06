"use client";

import { useMemo } from "react";
import { Odontogram } from "./Odontogram";
import { chartMarks, chartRegions, contradictions } from "@/lib/extract/chart";
import { coverage, extractFacts } from "@/lib/extract/extract";
import {
  classifyUnparsedSpans,
  UNPARSED_CATEGORY_LABEL
} from "@/lib/extract/classifyUnparsed";
import { HelpTip } from "@/components/ui/HelpTip";

// THE READBACK PANEL — what the app understood, said back to the writer.
//
// Three things, in the order a writer needs them:
//
//   1. THE CHART. The note in pictures. This is the part that catches a
//      transposed tooth number, because "#41" instead of "#14" is a subtle
//      string difference and a glaring mark in the wrong quadrant.
//
//   2. CONTRADICTIONS. Deliberately almost always empty. See chart.ts for the
//      alert-fatigue arithmetic that keeps the list at two rules.
//
//   3. COVERAGE, stated honestly. How much of this note the app could read.
//
// WHY COVERAGE IS SHOWN AT ALL, when most products would hide it: because the
// alternative is worse. A tool that silently understands 60% of a note looks
// identical to one that understands all of it, right up until someone trusts
// the chart and the chart was drawn from two thirds of the facts. Saying "I
// read 11 of 14 phrases, here are the 3 I did not" turns an invisible gap into
// a visible one, and it is the difference between an assistant and an oracle.
//
// It is also the honest growth signal for the grammar: the phrases real staff
// type that we cannot read are the ones worth teaching it next, as opposed to
// the ones we imagine they type.

export function NoteReadback({ text, onJumpTo }: { text: string; onJumpTo?: (offset: number) => void }) {
  const result = useMemo(() => extractFacts(text), [text]);
  const marks = useMemo(() => chartMarks(result), [result]);
  const regions = useMemo(() => chartRegions(result), [result]);
  const conflicts = useMemo(() => contradictions(result), [result]);
  const unread = useMemo(
    () => classifyUnparsedSpans(text, result.unparsed),
    [text, result.unparsed]
  );
  const read = Math.round(coverage(result) * 100);
  const understood = result.clauseCount - result.unparsed.length;

  const jump = (offset: number) => onJumpTo?.(offset);

  return (
    <div className="space-y-4 text-sm">
      {conflicts.length > 0 && (
        <div className="rounded-lg border-l-4 border-l-red-500 bg-red-50/60 py-3 pl-3 pr-4">
          <p className="font-semibold text-red-900">
            {conflicts.length === 1 ? "This note contradicts itself" : "This note contradicts itself in " + conflicts.length + " places"}
          </p>
          <ul className="mt-1 space-y-1 text-red-900">
            {conflicts.map((c) => (
              <li key={`${c.id}-${c.toothId}`}>
                <strong>Tooth {c.toothId}:</strong> {c.why}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="section-title mb-1 text-title-3">What this note says about the teeth</h3>
        <p className="mb-2 text-xs text-slate-600">
          Drawn from the note, not entered separately. If a tooth is marked here that you did not mean, the
          note names it — that is what this view is for.
        </p>
        <Odontogram
          marks={marks}
          regions={regions}
          onSelectTooth={(id) => {
            const mark = marks.find((m) => m.toothId === id);
            if (mark?.spans[0]) jump(mark.spans[0].start);
          }}
        />
      </div>

      {marks.length > 0 && (
        <ul className="space-y-1">
          {marks.map((m) => (
            <li key={m.toothId} className="flex flex-wrap items-baseline gap-x-2">
              <button
                type="button"
                onClick={() => m.spans[0] && jump(m.spans[0].start)}
                className="font-semibold text-brand-navy underline decoration-dotted underline-offset-2"
              >
                Tooth {m.toothId}
              </button>
              <span className="text-slate-800">
                {m.procedure ?? "named, no procedure stated"}
                {m.surfaces.length > 0 && ` · ${m.surfaces.join("")}`}
              </span>
              {m.status === "negated" && (
                <span className="rounded bg-slate-200 px-1.5 text-xs text-slate-700">recorded as absent</span>
              )}
              {m.hint && (
                <span className="rounded bg-slate-200 px-1.5 text-xs text-slate-700">
                  reads as {m.hint} — confirm
                </span>
              )}
              {m.impossibleSurfaces.length > 0 && (
                <span className="rounded bg-red-100 px-1.5 text-xs font-medium text-red-900">
                  tooth {m.toothId} has no {m.impossibleSurfaces.join(" or ")} surface
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* The honest denominator. Stated as a fraction of phrases rather than a
          percentage alone, because "78%" invites a reader to round it up to
          "basically all of it" and "11 of 14" does not. */}
      <div className="card-inset">
        <p className="flex flex-wrap items-center gap-1.5 text-slate-800">
          <strong>
            Read {understood} of {result.clauseCount} {result.clauseCount === 1 ? "phrase" : "phrases"}
          </strong>
          {result.clauseCount > 0 && ` (${read}%).`}
          <HelpTip label="About unread phrases">
            Unread phrases stay off the chart. Category labels are questions for you — never
            invented facts. Rewrite the phrase in plain clinical words so the tool can read it.
          </HelpTip>
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {result.unparsed.length > 0
            ? "The rest is kept exactly as you wrote it and is not shown on the chart above."
            : "Everything in this note was recognised."}
        </p>
        {unread.length > 0 && (
          <ul className="mt-2 space-y-2 text-xs text-slate-700">
            {unread.slice(0, 6).map((item, i) => (
              <li key={i} className="rounded border border-slate-200 bg-white/80 px-2 py-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-600">
                    {UNPARSED_CATEGORY_LABEL[item.category]}
                  </span>
                  <button
                    type="button"
                    onClick={() => jump(item.span.start)}
                    className="text-left font-medium text-brand-navy underline decoration-dotted underline-offset-2"
                  >
                    “{text.slice(item.span.start, Math.min(item.span.end, item.span.start + 70))}
                    {item.span.end - item.span.start > 70 ? "…" : ""}”
                  </button>
                </div>
                <p className="mt-0.5 text-slate-600">{item.ask}</p>
              </li>
            ))}
            {unread.length > 6 && <li>…and {unread.length - 6} more.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
