"use client";

import { useMemo } from "react";
import { countWords, diffTokens, isFormattingOnly } from "@/lib/diff/tokenDiff";

// The one place this app shows a person what it did to their words.
//
// Used by both transformation paths, which is the point: the deterministic
// standardizer and the AI assist make different KINDS of change, and a
// clinician should not have to learn two ways of reading them.
//
// Colour is never the only signal. Removed text is struck through and carries a
// screen-reader "removed" label; added text is underlined and labelled "added".
// That keeps the view readable in forced-colors mode and for anyone who cannot
// separate the two hues — the same rule the severity ramp follows elsewhere.

export function TextDiff({
  before,
  after,
  className = ""
}: {
  before: string;
  after: string;
  className?: string;
}) {
  const spans = useMemo(() => diffTokens(before, after), [before, after]);
  const formattingOnly = useMemo(() => isFormattingOnly(before, after), [before, after]);

  if (before === after) {
    return <p className={`text-xs text-slate-600 ${className}`}>No change.</p>;
  }

  // Spacing and full stops only. Rendering the markup would bury a real
  // substitution under punctuation on the very runs where nothing happened.
  if (formattingOnly) {
    return (
      <p className={`text-xs text-slate-600 ${className}`}>
        Spacing and punctuation only — no word changed.
      </p>
    );
  }

  const removed = countWords(spans, "removed");
  const added = countWords(spans, "added");

  return (
    <div className={className}>
      <p className="mb-1 text-xs text-slate-600">
        {removed} word{removed === 1 ? "" : "s"} out, {added} word{added === 1 ? "" : "s"} in.
      </p>
      <p
        className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-slate-300 bg-white p-2 text-sm leading-relaxed"
        tabIndex={0}
        role="region"
        aria-label="What changed in this text"
      >
        {spans.map((s, i) => {
          if (s.op === "same") return <span key={i}>{s.text}</span>;
          if (s.op === "removed") {
            return (
              <del key={i} className="bg-rose-100 text-rose-900 decoration-rose-500">
                <span className="sr-only">removed: </span>
                {s.text}
              </del>
            );
          }
          return (
            <ins key={i} className="bg-emerald-100 text-emerald-900 decoration-emerald-600">
              <span className="sr-only">added: </span>
              {s.text}
            </ins>
          );
        })}
      </p>
    </div>
  );
}
