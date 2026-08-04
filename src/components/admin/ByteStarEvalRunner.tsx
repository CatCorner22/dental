"use client";

import { useState } from "react";

interface CanaryResult {
  id: string;
  expected: string;
  outcome: string;
  pass: boolean;
  kept: number;
  refused: number;
}

interface CanaryReport {
  results: CanaryResult[];
  passed: number;
  total: number;
  keptTotal: number;
  refusedTotal: number;
}

export function ByteStarEvalRunner() {
  const [report, setReport] = useState<CanaryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Canary eval — run against the live model</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            Six frozen synthetic drafts through the full pipeline. Every expectation is a
            deterministic property of the outcome, so a moved number between two runs means the
            model moved — not the drafts, not the rails. Costs a handful of model calls; the
            result logs one transparent row.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 text-xs"
          disabled={running}
          onClick={() => {
            setRunning(true);
            setError(null);
            void fetch("/api/bytestar", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "run-eval" })
            })
              .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "Eval failed");
                setReport(data.report as CanaryReport);
              })
              .catch((e: Error) => setError(e.message))
              .finally(() => setRunning(false));
          }}
        >
          {running ? "Running canaries…" : "Run eval"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-slate-700">{error}</p>}

      {report && (
        <div className="mt-3">
          <p className="text-sm font-semibold tabular-nums text-brand-navy">
            {report.passed}/{report.total} canaries passed · {report.keptTotal} observations kept ·{" "}
            {report.refusedTotal} refused by the rails
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {report.results.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-2">
                <span className={r.pass ? "font-semibold text-teal-700" : "font-semibold text-amber-800"}>
                  {r.pass ? "pass" : "fail"}
                </span>
                <span className="font-mono text-slate-700">{r.id}</span>
                <span className="text-slate-500">
                  expected {r.expected}, got {r.outcome}
                  {r.kept + r.refused > 0 && ` · kept ${r.kept}, refused ${r.refused}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
