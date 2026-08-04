"use client";

import { useState } from "react";
import { standardize } from "@/lib/standardize/standardize";
import { runTextAudit } from "@/lib/audit/engine";

// BATCH RE-CHECK — end-of-day charting runs several short notes at once.
//
// Each note still goes through the full single-note path before it can be
// copied: this view TRIAGES (which notes are clean, which need work) and
// loads one into the main checker. It deliberately has no copy button of its
// own — the resolution queue stays the only door out.

interface BatchRow {
  index: number;
  preview: string;
  blocking: number;
  flags: number;
  text: string;
}

export function BatchCheck({ onLoad }: { onLoad: (text: string) => void }) {
  const [batchInput, setBatchInput] = useState("");
  const [rows, setRows] = useState<BatchRow[] | null>(null);

  const check = () => {
    const parts = batchInput
      .split(/^\s*---\s*$/m)
      .map((p) => p.trim())
      .filter(Boolean);
    setRows(
      parts.map((text, index) => {
        const pass = standardize(text);
        const findings = runTextAudit(pass.text);
        // Same arithmetic the resolution queue uses: blocking audit findings
        // plus every judgment-call flag the writer must resolve or attest.
        const blocking =
          findings.filter((f) => f.severity === "S0" || f.severity === "S1").length +
          pass.flags.length;
        return {
          index,
          preview: text.replace(/\s+/g, " ").slice(0, 80),
          blocking,
          flags: pass.flags.length,
          text
        };
      })
    );
  };

  return (
    <details className="mt-3 rounded border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        Check several notes at once — end-of-day triage
      </summary>
      <p className="mt-1 text-xs text-slate-500">
        Paste multiple de-identified notes separated by a line containing only{" "}
        <code className="rounded bg-slate-100 px-1">---</code>. Each is checked read-only; load one
        into the main box to resolve and copy it. There is no batch copy — every note still clears
        its own queue.
      </p>
      <textarea
        className="field-input mt-2 min-h-[8rem] font-mono text-xs"
        value={batchInput}
        onChange={(e) => setBatchInput(e.target.value)}
        placeholder={"First note…\n---\nSecond note…\n---\nThird note…"}
        aria-label="Batch notes, separated by --- lines"
      />
      <button
        type="button"
        className="btn-secondary mt-2 text-xs"
        disabled={!batchInput.trim()}
        onClick={check}
      >
        Check all
      </button>
      {rows && (
        <ul className="mt-3 space-y-1.5">
          {rows.length === 0 && <li className="text-xs text-slate-500">Nothing to check yet.</li>}
          {rows.map((r) => (
            <li
              key={r.index}
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs ${
                r.blocking > 0
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-green-300 bg-green-50 text-green-900"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <strong>Note {r.index + 1}:</strong> {r.preview}
              </span>
              <span className="shrink-0 tabular-nums">
                {r.blocking > 0 ? `${r.blocking} to resolve` : "clean"}
              </span>
              <button type="button" className="btn-secondary shrink-0 text-xs" onClick={() => onLoad(r.text)}>
                Load
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
