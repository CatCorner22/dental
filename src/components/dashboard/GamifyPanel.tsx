import Link from "next/link";
import type { RankProgress } from "@/lib/gamify/ranks";

// The progression panel: rank, points, the 30-day GPA trend, and the last
// few graded filings. STRICTLY PRIVATE — this renders only the viewer's own
// numbers, and says out loud what a lead can see (the band, never per-note
// scores), because a system people trust is one that states its own rules.
//
// The supportive band is deliberately not an alert: no red, no "warning", no
// countdown. It offers help and a bounty, and it leads with the fact that
// the queue's inline standard-wording hints are already doing the work.

export interface GamifyView {
  rankProgress: RankProgress;
  xp: number;
  balance: number;
  rollingGpa: number | null;
  /** Daily average GPA for the last 30 days, oldest first. */
  trend: { day: string; gpa: number }[];
  recent: { id: number; ticket: string; gpa: string | null; whenEt: string }[];
  /** Deterministic insight lines from subscore aggregates. */
  insights: string[];
}

function TrendLine({ trend }: { trend: { day: string; gpa: number }[] }) {
  if (trend.length < 2) {
    return (
      <p className="text-xs text-slate-500">
        The trend line appears after a couple of graded filing days.
      </p>
    );
  }
  const w = 280;
  const h = 60;
  const min = 0;
  const max = 4;
  const step = w / (trend.length - 1);
  const points = trend
    .map((t, i) => `${(i * step).toFixed(1)},${(h - ((t.gpa - min) / (max - min)) * h).toFixed(1)}`)
    .join(" ");
  const rising =
    trend.length >= 4 &&
    trend.slice(-Math.ceil(trend.length / 2)).reduce((a, t) => a + t.gpa, 0) /
      Math.ceil(trend.length / 2) >
      trend.slice(0, Math.floor(trend.length / 2)).reduce((a, t) => a + t.gpa, 0) /
        Math.floor(trend.length / 2) +
        0.05;
  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h + 4}`}
        className="h-16 w-full"
        role="img"
        aria-label={`GPA trend over the last ${trend.length} filing days`}
      >
        {/* The 3.7 A-line, the standard worth seeing against every day. */}
        <line
          x1="0"
          y1={h - (3.7 / 4) * h}
          x2={w}
          y2={h - (3.7 / 4) * h}
          stroke="#5FB3A8"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        <polyline points={points} fill="none" stroke="#2B6CB8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {rising && (
        <p className="text-xs font-medium text-green-800">
          <span className="sparkle-pop mr-1 text-brand-gold" aria-hidden="true">✦</span>
          Momentum building — the trend is up.
        </p>
      )}
    </div>
  );
}

export function GamifyPanel({ view }: { view: GamifyView }) {
  const { rank, next, progress } = view.rankProgress;
  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="text-sm font-bold">{rank.title}</span>{" "}
          <span className="text-xs text-slate-500">· {view.xp.toLocaleString()} XP</span>
        </p>
        <p className="text-sm">
          <span className="font-bold text-brand-blue">{view.balance.toLocaleString()}</span>{" "}
          <span className="text-xs text-slate-500">points to spend</span>
        </p>
      </div>
      {next && (
        <div className="mt-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-teal"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {`${Math.round(progress * 100)}% of the way to ${next.title} (${next.minXp.toLocaleString()} XP) — unlocks: ${next.perk}`}
          </p>
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold text-slate-700">Last 30 days</h3>
          {view.rollingGpa !== null && (
            <span className="text-xs text-slate-500">
              rolling GPA <span className="font-bold text-slate-800">{view.rollingGpa.toFixed(2)}</span>
            </span>
          )}
        </div>
        <TrendLine trend={view.trend} />
      </div>

      {view.rollingGpa !== null && view.rollingGpa < 3.0 && view.recent.length >= 5 && (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <p>
            Some recent notes have been asking for a few more details to hit the A standard.
            Charting is genuinely hard — the queue&rsquo;s inline &ldquo;standard wording&rdquo;
            hints carry most of it, and a two-minute practice case covers the rest at a{" "}
            <strong>2× point bounty</strong>.
          </p>
          <Link href="/training" className="mt-1 inline-block text-sm font-medium text-blue-700 underline">
            Try a practice case
          </Link>
        </div>
      )}

      {view.insights.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h3 className="mb-1 text-xs font-semibold text-slate-700">Strengths and opportunities</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
            {view.insights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {view.recent.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h3 className="mb-1 text-xs font-semibold text-slate-700">Recent filings</h3>
          <ul className="space-y-0.5 text-xs">
            {view.recent.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-2">
                <Link href={`/history/${r.id}`} className="text-blue-700 underline">
                  {r.ticket}
                </Link>
                <span className="text-slate-500">{r.whenEt}</span>
                <span className="w-10 text-right font-mono font-semibold">
                  {r.gpa ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-400">
        These numbers are yours alone. Colleagues never see them; a Team Lead sees only a coaching
        band (thriving / stable / support offered), never your per-note scores.
      </p>
    </div>
  );
}
