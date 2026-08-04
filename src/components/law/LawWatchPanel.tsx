"use client";

import { useState } from "react";
import type { WatchSweep } from "@/lib/law/watch";

// The Legal Watch control — Team Lead and above. One button runs the agents;
// every reported item links to its watched source, because the sweep is a
// pointer to primary authority, never a substitute for reading it.

export function LawWatchPanel() {
  const [sweep, setSweep] = useState<WatchSweep | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Legal Watch agents</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            Six agents scan the official sources this library cites — rule filings, Board notices,
            new session law, CSMD, HIPAA, ADA standards. Items are pointers to the primary source,
            never a substitute for reading it; nothing updates this library without human review.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 text-xs"
          disabled={running}
          onClick={() => {
            setRunning(true);
            setError(null);
            void fetch("/api/law-watch", { method: "POST" })
              .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "Sweep failed");
                setSweep(data.sweep as WatchSweep);
              })
              .catch((e: Error) => setError(e.message))
              .finally(() => setRunning(false));
          }}
        >
          {running ? "Agents scanning…" : "Run watch sweep"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-slate-700">{error}</p>}

      {sweep && (
        <div className="mt-3 space-y-2">
          <p className="text-[0.65rem] text-slate-500">
            Sweep at {sweep.at.replace("T", " ").slice(0, 19)}Z ·{" "}
            {sweep.aiEnabled ? "AI summaries on" : "keyword signals only (AI assist off)"}
          </p>
          {sweep.sources.map((s) => (
            <div key={s.sourceId} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200/80">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-brand-blue underline decoration-dotted underline-offset-2"
                >
                  {s.label}
                </a>
                <span className="text-[0.65rem] tabular-nums text-slate-500">
                  {s.status === "fetch-failed"
                    ? "unreachable"
                    : s.status === "no-signal"
                      ? "no dental signal"
                      : `${s.keywordHits} keyword signals`}
                </span>
              </div>
              {s.items.map((item, i) => (
                <div key={i} className="mt-1.5 border-l-2 border-brand-teal/50 pl-2">
                  <p className="text-xs font-medium text-slate-800">{item.title}</p>
                  <p className="text-[0.7rem] text-slate-600">{item.whyRelevant}</p>
                </div>
              ))}
              {s.note && <p className="mt-1 text-[0.65rem] text-slate-500">{s.note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
