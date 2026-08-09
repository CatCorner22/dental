"use client";

import { useState } from "react";
import { standardize } from "@/lib/standardize/standardize";
import { runTextAudit } from "@/lib/audit/engine";

// BATCH RE-CHECK — end-of-day charting runs several short notes at once.
//
// This view TRIAGES: which notes are clean, which need work. It is deliberately
// not a way OUT of the tool. A note reaches a chart through the note builder,
// past the audit and the two-identifier check, or it does not reach one — so
// the only action per row is to copy that note's own text back out so it can be
// pasted into a note and finished properly.
//
// It used to live inside the standardize screen and take an onLoad callback
// that dropped a note into "the main box". There is no main box now; the note
// builder is the page, and one note at a time is the point.

interface BatchRow {
  index: number;
  preview: string;
  blocking: number;
  flags: number;
  text: string;
}

export function BatchTriage() {
  const [batchInput, setBatchInput] = useState("");
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const copyOne = async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Clipboard refused (permissions, insecure origin). The text is on
      // screen; saying nothing is better than a false confirmation.
    }
  };

  return (
    <div className="card">
      <textarea
        /* No text-xs — it beats the 16px iOS zoom guard on .field-input (see
           globals.css). font-mono and min-h are different properties and safe. */
        className="field-input mt-2 min-h-[8rem] font-mono"
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
              {/* Copy ONLY when the row's checks came back clean. An amber row
                  copied to the clipboard is a note leaving the tool around the
                  audit — the exact path the builder's export gates close, and
                  the page's stated contract ("past the audit ... or it does
                  not leave"). Blocked notes go through the builder. */}
              {r.blocking > 0 ? (
                <span className="shrink-0 text-[0.65rem] text-amber-800">resolve in the builder</span>
              ) : (
                <button
                  type="button"
                  className="btn-secondary shrink-0 text-xs"
                  onClick={() => copyOne(r.index, r.text)}
                >
                  {copiedIndex === r.index ? "Copied ✓" : "Copy this one"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
