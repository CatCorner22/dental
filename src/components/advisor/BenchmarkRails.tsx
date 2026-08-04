"use client";

import type { BenchmarkReading, DriftDirection } from "@/lib/bytestar/benchmarks";

// DRIFT-TO-TARGET GRAPHICS — one rail per benchmark. Direction is the signal;
// no confidence percentages (a stated AI non-goal). Severity colours stay out:
// toward / on-target use teal; away uses slate emphasis, not the audit alarm
// palette, because ByteStar advises and never blocks.

function dirLabel(d: DriftDirection): string {
  switch (d) {
    case "on-target":
      return "On target";
    case "toward":
      return "Toward target";
    case "away":
      return "Away from target";
    default:
      return "Not applicable";
  }
}

function dirClass(d: DriftDirection): string {
  switch (d) {
    case "on-target":
      return "text-teal-700";
    case "toward":
      return "text-brand-blue";
    case "away":
      return "text-slate-700";
    default:
      return "text-slate-400";
  }
}

function fillClass(d: DriftDirection): string {
  switch (d) {
    case "on-target":
      return "bg-brand-teal";
    case "toward":
      return "bg-brand-blue";
    case "away":
      return "bg-slate-400";
    default:
      return "bg-slate-200";
  }
}

function Arrow({ direction }: { direction: DriftDirection }) {
  if (direction === "n/a") return <span aria-hidden>·</span>;
  if (direction === "on-target") return <span aria-hidden>✓</span>;
  if (direction === "toward") return <span aria-hidden>↑</span>;
  return <span aria-hidden>↓</span>;
}

export function BenchmarkRails({ readings }: { readings: BenchmarkReading[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {readings.map((r) => {
        // Density is a raw count; others are 0..1. Normalize for the bar.
        const pct =
          r.id === "density"
            ? Math.max(0, Math.min(100, (r.value / 60) * 100))
            : Math.round(r.value * 100);
        const targetPct =
          r.id === "density"
            ? Math.round((20 / 60) * 100)
            : Math.round(r.target * 100);
        return (
          <li key={r.id} className="rounded-lg bg-white/80 p-2 ring-1 ring-amber-200/60">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-800">{r.label}</span>
              <span className={`font-semibold tabular-nums ${dirClass(r.direction)}`}>
                <Arrow direction={r.direction} /> {dirLabel(r.direction)}
              </span>
            </div>
            <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-[width] ${fillClass(r.direction)}`}
                style={{ width: `${pct}%` }}
              />
              {/* Target tick. */}
              <span
                className="absolute top-0 h-full w-0.5 bg-slate-700/50"
                style={{ left: `${targetPct}%` }}
                title="Target"
              />
            </div>
            <p className="mt-1 text-[0.65rem] text-slate-500">{r.note}</p>
          </li>
        );
      })}
    </ul>
  );
}
