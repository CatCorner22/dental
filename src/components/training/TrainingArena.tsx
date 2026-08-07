"use client";

import { useState } from "react";
import type { TrainingScenario } from "@/lib/training/scenarios";
import { severityLabel } from "@/lib/audit/types";

// The practice surface. Same feel as real work — edit the text, clear the
// findings — with the pressure removed: no patient, no ticket, no filing,
// and the audit's suggestions visible from the first attempt. Practice is
// where hints belong at full brightness.

interface Finding {
  ruleId: string;
  severity: string;
  message: string;
  suggestion: string | null;
}

export function TrainingArena({ scenarios }: { scenarios: TrainingScenario[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = scenarios.find((s) => s.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      {!active && (
        <ul className="grid gap-3 sm:grid-cols-3">
          {scenarios.map((s) => (
            <li key={s.id} className="card flex flex-col justify-between p-3">
              <div>
                <p className="text-xs font-semibold text-brand-teal">
                  trains {s.axis}
                </p>
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-xs text-slate-500">{s.blurb}</p>
              </div>
              <button className="btn-primary mt-3 text-xs" onClick={() => setActiveId(s.id)}>
                Start — {s.bounty} pt bounty
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && <Attempt scenario={active} onExit={() => setActiveId(null)} />}
    </div>
  );
}

function Attempt({ scenario, onExit }: { scenario: TrainingScenario; onExit: () => void }) {
  const [text, setText] = useState(scenario.text);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [done, setDone] = useState<{ bounty: number; alreadyEarned: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/training/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not check the attempt.");
      } else if (data.complete) {
        setDone({ bounty: data.bounty, alreadyEarned: data.alreadyEarned });
      } else {
        setFindings(data.findings ?? []);
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{scenario.title}</h2>
          <button className="text-xs text-slate-500 underline" onClick={onExit}>
            Back to cases
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Fully synthetic — no patient, no filing. Repair the note until the check comes back
          clean. The findings show the standard wording from the first attempt: practice is where
          hints run at full brightness.
        </p>
        <textarea
          className="field-input min-h-[14rem] font-mono text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Practice note"
        />
        <div className="mt-2 flex gap-2">
          <button className="btn-primary" onClick={check} disabled={busy || done !== null}>
            {busy ? "Checking…" : "Check my repair"}
          </button>
          <button className="btn-secondary" onClick={() => { setText(scenario.text); setFindings(null); }} disabled={busy || done !== null}>
            Reset
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      <div>
        {done ? (
          <div className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900" role="status">
            <p className="font-semibold">
              <span className="sparkle-pop mr-1 text-brand-gold" aria-hidden="true">✦</span>
              Clean. That is exactly the note a later reader hopes to find.
            </p>
            <p className="mt-1">
              {done.alreadyEarned
                ? "This case's bounty was already earned — the skill still compounds."
                : `${done.bounty} points landed in your balance.`}
            </p>
          </div>
        ) : findings === null ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            The check results appear here — what a reviewer would still ask, and the standard
            wording that answers it.
          </div>
        ) : (
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li key={i} className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="text-xs font-semibold">{severityLabel(f.severity)}</p>
                <p>{f.message}</p>
                {f.suggestion && (
                  <p className="mt-1 text-xs">
                    <span className="font-semibold">Standard wording:</span> {f.suggestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
