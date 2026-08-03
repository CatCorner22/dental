"use client";

import { useRef, useState } from "react";
import { SEVERITY_CLASS, SEVERITY_LABELS } from "@/lib/audit/types";
import type { Severity } from "@/lib/audit/types";

interface Applied {
  kind: string;
  from: string;
  to: string;
  count: number;
  why: string;
}
interface Flag {
  kind: string;
  display: string;
  guidance: string;
  count: number;
}
interface Finding {
  ruleId: string;
  category: string;
  severity: Severity;
  message: string;
  matchedText: string | null;
  occurrences: number;
}
interface Result {
  text: string;
  applied: Applied[];
  flags: Flag[];
  clean: boolean;
  findings: Finding[];
}


export function Standardizer() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/standardize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: input })
      });
      const data = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not standardize that text.");
      } else {
        setResult(data);
        // Move focus to the result so a keyboard or screen-reader user is not
        // left at the button wondering whether anything happened.
        setTimeout(() => outputRef.current?.focus(), 50);
      }
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The clipboard is blocked in this browser. Select the text and copy it by hand.");
    }
  };

  // S0 and S1 are the ones that would block a note leaving the builder. Here
  // they are advice — this screen produces text to paste elsewhere, so it warns
  // rather than blocks, and says so.
  const blocking = result?.findings.filter((f) => f.severity === "S0" || f.severity === "S1") ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <label className="field-label" htmlFor="std-in">
          Paste your note
        </label>
        <textarea
          id="std-in"
          className="field-input min-h-[16rem] font-mono text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste the note exactly as you would write it. De-identified facts only — no patient name, exact date, contact detail, or record number."
          aria-describedby="std-help"
        />
        <p id="std-help" className="mt-1 text-xs text-slate-500">
          {input.length.toLocaleString()} characters. Nothing you paste here is saved — the text is
          standardized in memory and returned.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={run} disabled={busy || !input.trim()}>
            {busy ? "Standardizing…" : "Standardize"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setInput("");
              setResult(null);
              setError("");
            }}
            disabled={busy || (!input && !result)}
          >
            Clear
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="field-label mb-0">Standardized note</span>
          {result && (
            <button className="btn-secondary" onClick={copy}>
              {copied ? "Copied ✓" : "Copy for Curve Hero"}
            </button>
          )}
        </div>
        <div
          ref={outputRef}
          tabIndex={-1}
          role="region"
          aria-live="polite"
          aria-label="Standardized note"
          className="min-h-[16rem] whitespace-pre-wrap rounded border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {result ? (
            result.text
          ) : (
            <span className="text-slate-400">
              The standardized note appears here, ready to copy into Curve Hero.
            </span>
          )}
        </div>

        {result && (
          <div className="mt-4 space-y-4">
            {result.clean && result.findings.length === 0 && (
              <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
                Already standard. Nothing needed changing.
              </p>
            )}

            {result.applied.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-semibold text-slate-700">
                  Changed for you ({result.applied.length})
                </h2>
                <ul className="space-y-1 text-sm">
                  {result.applied.map((a, i) => (
                    <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
                      {a.kind === "formatting" ? (
                        <span>{a.why}</span>
                      ) : (
                        <span>
                          <span className="line-through decoration-slate-400">{a.from}</span>{" "}
                          <span aria-hidden="true">→</span>{" "}
                          <strong>{a.to}</strong>
                          {a.count > 1 && (
                            <span className="text-slate-500"> ({a.count}×)</span>
                          )}
                          <span className="block text-xs text-slate-500">{a.why}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.flags.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-semibold text-slate-700">
                  Only you can fix these ({result.flags.length})
                </h2>
                <p className="mb-2 text-xs text-slate-500">
                  The right wording here depends on facts the note is hiding, so the tool will not
                  guess. Edit these by hand.
                </p>
                <ul className="space-y-1 text-sm">
                  {result.flags.map((f, i) => (
                    <li key={i} className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5">
                      <strong>{f.display}</strong>
                      {f.count > 1 && <span className="text-slate-600"> ({f.count}×)</span>}
                      <span className="block text-xs text-amber-900">{f.guidance}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.findings.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-semibold text-slate-700">
                  Audit of the result ({result.findings.length})
                </h2>
                {blocking.length > 0 && (
                  <p className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-900">
                    {blocking.length} finding{blocking.length === 1 ? "" : "s"} would stop this note
                    from leaving the note builder. This screen does not block — fix them before you
                    paste.
                  </p>
                )}
                <ul className="space-y-1 text-sm">
                  {result.findings.map((f, i) => (
                    <li
                      key={i}
                      className={`rounded border px-3 py-1.5 ${SEVERITY_CLASS[f.severity] ?? SEVERITY_CLASS.S4}`}
                    >
                      <span className="text-xs font-semibold uppercase">
                        {f.severity} {SEVERITY_LABELS[f.severity] ?? ""}
                      </span>
                      <span className="block">{f.message}</span>
                      {f.matchedText && (
                        <span className="block text-xs opacity-80">
                          in “{f.matchedText}”
                          {f.occurrences > 1 && ` (${f.occurrences}×)`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
