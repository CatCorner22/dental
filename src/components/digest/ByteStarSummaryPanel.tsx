import Link from "next/link";
import type { ByteStarSummary } from "@/lib/bytestar/summary";

// The pioneer's period report inside the Team Lead digest: did the cage hold,
// and is the model earning its calls. Counts and codes only — the same
// privacy contract as the transparent log it rolls up.

export function ByteStarSummaryPanel({
  summary,
  windowDays
}: {
  summary: ByteStarSummary;
  windowDays: number;
}) {
  if (summary.runs === 0 && summary.escapes.total === 0 && summary.evals.runs === 0) return null;

  const ok = summary.outcomes.ok ?? 0;
  const yieldLine =
    summary.keptTotal + summary.refusedTotal > 0
      ? `${summary.keptTotal} observations shown, ${summary.refusedTotal} refused by the rails`
      : "no observations reached the screen";
  const profileLine = Object.entries(summary.profiles)
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `${p}: ${n}`)
    .join(" · ");

  return (
    <section className="mt-6">
      <h2 className="section-title">SuperByte — the pioneer&rsquo;s period report</h2>
      <p className="mb-2 max-w-3xl text-xs text-slate-600">
        The last {windowDays} days of the transparent log, rolled up. Refusals are the rails
        working, not the model failing; a quiet strict read is the system doing its job. Full rows
        on the{" "}
        <Link href="/admin/bytestar" className="underline">
          SuperByte monitor
        </Link>
        .
      </p>
      <div className="card">
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <dt className="font-semibold text-slate-600">Model reads</dt>
          <dd>
            {summary.runs} run{summary.runs === 1 ? "" : "s"} · {ok} returned observations
          </dd>
          <dt className="font-semibold text-slate-600">Yield</dt>
          <dd>{yieldLine}</dd>
          {profileLine && (
            <>
              <dt className="font-semibold text-slate-600">Router profiles</dt>
              <dd>{profileLine}</dd>
            </>
          )}
          <dt className="font-semibold text-slate-600">Cage events</dt>
          <dd>
            {summary.escapes.total === 0
              ? "no escape attempts"
              : `${summary.escapes.total} escape event${summary.escapes.total === 1 ? "" : "s"} (${summary.escapes.modelOriginated} model-originated${
                  Object.keys(summary.escapes.stages).length > 0
                    ? `; ${Object.entries(summary.escapes.stages)
                        .map(([s, n]) => `${s}: ${n}`)
                        .join(", ")}`
                    : ""
                })`}
            {summary.permaKills > 0 && ` · ${summary.permaKills} perma-kill`}
            {summary.permaClears > 0 && ` · ${summary.permaClears} cleared by a Team Lead`}
          </dd>
          <dt className="font-semibold text-slate-600">Canary evals</dt>
          <dd>
            {summary.evals.runs === 0
              ? "none this period — worth one if the provider updated"
              : `${summary.evals.runs} run${summary.evals.runs === 1 ? "" : "s"} · latest pass ${summary.evals.lastPass ?? "n/a"}`}
          </dd>
          <dt className="font-semibold text-slate-600">Tokens</dt>
          <dd>{summary.tokens.toLocaleString()} across reads and evals</dd>
        </dl>
      </div>
    </section>
  );
}
