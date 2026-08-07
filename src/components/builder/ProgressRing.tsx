"use client";

import type { Severity } from "@/lib/audit/types";

// A small ring that fills toward a clean, fileable note. Purely visual;
// respects reduced-motion (no transition when the user prefers it).
//
// Filing authority caps the ring: a hygienist with a clean audit who still
// needs dentist filing must not see 100% green (UIX-003).
export function ProgressRing({
  counts,
  filingAllowed = true
}: {
  counts: Record<Severity, number>;
  filingAllowed?: boolean;
}) {
  const blockers = counts.S0 + counts.S1;
  const reviews = counts.S2;
  // 100% when no S0/S1/S2 remain AND filing is allowed; each blocker/review
  // pulls it down; handoff caps at 80% amber so the strip never reads "done".
  let pct = blockers > 0 ? 20 : reviews > 0 ? 70 : 100;
  if (pct === 100 && !filingAllowed) pct = 80;
  const r = 18;
  const c = 2 * Math.PI * r;
  const color =
    blockers > 0
      ? "text-red-500"
      : reviews > 0 || !filingAllowed
        ? "text-amber-500"
        : "text-green-500";
  const label =
    !filingAllowed && blockers === 0 && reviews === 0
      ? "Audit clear — dentist must file"
      : `Audit progress ${pct}%`;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0" role="img" aria-label={label}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 24 24)"
        className={`${color} motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500`}
      />
      <text x="24" y="28" textAnchor="middle" className="fill-slate-700 text-[10px] font-bold">
        {pct}%
      </text>
    </svg>
  );
}
