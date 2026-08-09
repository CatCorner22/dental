"use client";

import type { Severity } from "@/lib/audit/types";

// A small ring that fills toward a clean, fileable note. Purely visual;
// respects reduced-motion (no transition when the user prefers it).
//
// Filing authority caps the ring: a hygienist with a clean audit who still
// needs dentist filing must not see 100% green (UIX-003).
//
// Co-design (CVD / a11y): color is secondary. Shape glyph + visible state word
// travel with the percent so deuteranopia cannot collapse Stop vs Review vs Ready.
export function ProgressRing({
  counts,
  filingAllowed = true
}: {
  counts: Record<Severity, number>;
  filingAllowed?: boolean;
}) {
  const blockers = counts.S0 + counts.S1;
  const reviews = counts.S2;
  let pct = blockers > 0 ? 20 : reviews > 0 ? 70 : 100;
  if (pct === 100 && !filingAllowed) pct = 80;
  const r = 18;
  const c = 2 * Math.PI * r;
  const state =
    blockers > 0
      ? counts.S0 > 0
        ? ({ word: "Stop", shape: "■", color: "text-severity-stop-rail", cap: "butt" as const } as const)
        : ({
            word: "Required",
            shape: "▲",
            color: "text-severity-required-rail",
            cap: "butt" as const
          } as const)
      : reviews > 0
        ? ({
            word: "Review",
            shape: "◆",
            color: "text-severity-review-rail",
            cap: "square" as const
          } as const)
        : !filingAllowed
          ? ({ word: "Handoff", shape: "→", color: "text-slate-500", cap: "round" as const } as const)
          : ({
              word: "Ready",
              shape: "●",
              color: "text-severity-clear-rail",
              cap: "round" as const
            } as const);
  const label =
    !filingAllowed && blockers === 0 && reviews === 0
      ? "Handoff — audit clear, dentist must file"
      : `${state.word} — audit progress ${pct}%`;
  return (
    <div className="flex shrink-0 items-center gap-2" role="img" aria-label={label}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap={state.cap}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 24 24)"
          className={`${state.color} motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500`}
        />
        <text x="24" y="22" textAnchor="middle" className="fill-slate-800 text-[11px] font-bold">
          {state.shape}
        </text>
        <text x="24" y="34" textAnchor="middle" className="fill-slate-700 text-[9px] font-bold">
          {pct}%
        </text>
      </svg>
      <span className="max-w-[4.5rem] text-xs font-semibold leading-tight text-slate-800">
        {state.word}
      </span>
    </div>
  );
}
