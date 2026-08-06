"use client";

import { useEffect, useState } from "react";
import { statusLabel } from "@/lib/audit/types";

// PRIOR-NOTE COMPARISON — a frozen filed note beside the draft in progress.
//
// Read-only by architecture: this pane renders text from the submissions
// record and offers no way to copy it into the draft wholesale. Copy-forward
// is the defect half the audit rules exist to catch; the pane is for
// CHECKING against the past visit, not repeating it.

interface PriorRow {
  id: number;
  ticket: string;
  submittedByName: string;
  submittedAtEt: string;
  auditStatus: string;
}

interface PriorDetail extends PriorRow {
  ruleVersion: string;
  noteMarkdown: string;
}

export function PriorNotes() {
  const [rows, setRows] = useState<PriorRow[] | null>(null);
  const [detail, setDetail] = useState<PriorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/submissions?limit=10")
      .then((r) => r.json())
      .then((d: { submissions?: PriorRow[] }) => {
        if (!cancelled) setRows(Array.isArray(d.submissions) ? d.submissions : []);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError("Could not load prior notes.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (id: number) => {
    setLoading(true);
    setError("");
    void fetch(`/api/submissions/${id}`)
      .then((r) => r.json())
      .then((d: { submission?: PriorDetail; error?: string }) => {
        if (d.submission) setDetail(d.submission);
        else setError(d.error ?? "Could not load that note.");
      })
      .catch(() => setError("Could not load that note."))
      .finally(() => setLoading(false));
  };

  if (detail) {
    return (
      <div>
        <button type="button" className="btn-secondary mb-2 text-xs" onClick={() => setDetail(null)}>
          ← Back to the list
        </button>
        <p className="text-xs text-slate-600">
          <span className="font-semibold">{detail.ticket}</span> · {detail.submittedByName} ·{" "}
          {detail.submittedAtEt} · {statusLabel(detail.auditStatus)} · ruleset {detail.ruleVersion}
        </p>
        <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[0.65rem] text-amber-900">
          Frozen record, shown for comparison. Write this visit&rsquo;s facts fresh — copied-forward
          text is exactly what the audit&rsquo;s stale-text rules catch.
        </p>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
          {detail.noteMarkdown}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-600">
        Recent filed notes, read-only. Open one to check what the last visit recorded while you
        write this one.
      </p>
      {error && (
        <p className="mb-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">No filed notes yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 rounded border border-slate-200 px-2.5 py-1.5 text-left text-xs hover:bg-slate-50"
                disabled={loading}
                onClick={() => open(r.id)}
              >
                <span className="font-medium text-slate-800">{r.ticket}</span>
                <span className="text-slate-500">
                  {r.submittedAtEt} · {statusLabel(r.auditStatus)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
