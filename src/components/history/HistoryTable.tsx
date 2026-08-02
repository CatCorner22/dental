"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface HistoryRow {
  id: number;
  ticket: string;
  label: string;
  by: string;
  at: string;
  status: string;
  rules: string;
}

// Client-side search + status filter over the already-fetched rows. The list
// is office-sized (hundreds, not millions), so filtering in the browser keeps
// the server page simple and the interaction instant.
export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return [...counts.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (!q) return true;
      return (
        r.ticket.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.by.toLowerCase().includes(q)
      );
    });
  }, [rows, query, status]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="field-input max-w-xs"
          placeholder="Search ticket, note, or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search submissions by ticket, note label, or submitter"
        />
        {statuses.length > 1 &&
          statuses.map(([s, n]) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(status === s ? null : s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                status === s
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-blue-50"
              }`}
            >
              {s} ({n})
            </button>
          ))}
        {(query || status) && (
          <span className="text-xs text-slate-500" role="status">
            {filtered.length} of {rows.length} shown
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Ticket</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2">Eastern time</th>
              <th className="px-3 py-2">Audit status</th>
              <th className="px-3 py-2">Rules</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-semibold">
                  <Link href={`/history/${r.id}`} className="text-blue-700 hover:underline">
                    {r.ticket}
                  </Link>
                </td>
                <td className="max-w-56 truncate px-3 py-2" title={r.label}>{r.label}</td>
                <td className="px-3 py-2">{r.by}</td>
                <td className="px-3 py-2">{r.at}</td>
                <td className="px-3 py-2 text-xs">{r.status}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{r.rules}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  No submission matches this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
