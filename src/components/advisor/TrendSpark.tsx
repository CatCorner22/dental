"use client";

// SESSION TREND — the temporal half of "drifting to or from target".
//
// The rails show where the draft stands NOW; this sparkline shows where the
// session has been heading. Client memory only: the samples live in component
// state, nothing is stored or sent, and the line resets with the page — it is
// a drafting instrument, not a record.

export interface TrendSample {
  v: number; // 0..1 on-course share
}

export function TrendSpark({ samples }: { samples: TrendSample[] }) {
  if (samples.length < 2) return null;
  const w = 96;
  const h = 22;
  const step = w / (samples.length - 1);
  const points = samples
    .map((s, i) => `${(i * step).toFixed(1)},${(h - 2 - s.v * (h - 4)).toFixed(1)}`)
    .join(" ");
  const last = samples[samples.length - 1].v;
  const first = samples[0].v;
  const improving = last >= first;
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0 opacity-90">
      <line x1={0} y1={h - 2} x2={w} y2={h - 2} stroke="#E2E8F0" strokeWidth={1} />
      <polyline
        points={points}
        fill="none"
        stroke={improving ? "#5FB3A8" : "#B45309"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={w}
        cy={h - 2 - last * (h - 4)}
        r={2}
        fill={improving ? "#5FB3A8" : "#B45309"}
      />
    </svg>
  );
}
