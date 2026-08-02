"use client";

import type { Severity } from "@/lib/audit/types";

// A small ring that fills toward a clean audit. Purely visual encouragement;
// respects reduced-motion (no transition when the user prefers it).
export function ProgressRing({ counts }: { counts: Record<Severity, number> }) {
  const blockers = counts.S0 + counts.S1;
  const reviews = counts.S2;
  // 100% when no S0/S1/S2 remain; each blocker/review pulls it down.
  const pct = blockers > 0 ? 20 : reviews > 0 ? 70 : 100;
  const r = 18;
  const c = 2 * Math.PI * r;
  const color = blockers > 0 ? "text-red-500" : reviews > 0 ? "text-amber-500" : "text-green-500";
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0" role="img" aria-label={`Audit progress ${pct}%`}>
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
