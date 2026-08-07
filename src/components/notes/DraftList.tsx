"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canTransferNotes, seesAllNotes, type Role } from "@/lib/auth/roles";
import { StatusChip } from "@/components/ui/StatusChip";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import { STATUS_META } from "@/lib/status/draftStatus";
import type { DraftStatus } from "@/lib/status/draftStatus";
import { TransferDraftDialog } from "./TransferDraftDialog";

// THE DRAFT LIST — search, status filters, and the per-row actions.
//
// It used to be the bottom two thirds of the dashboard. It moved here when the
// dashboard became the place you WRITE a note rather than the place you go
// looking for one: a list with its own search box and its own filter vocabulary
// is a destination, and destinations belong on their own page.
//
// Nothing about the behaviour changed in the move. Same search, same chips,
// same Transfer / New like this / Delete, same truncation notice.

export interface DraftRow {
  id: string;
  title: string;
  status: DraftStatus;
  ownerName?: string;
  mine: boolean;
  updatedAtLabel: string; // pre-formatted server-side (hydration-safe)
  moduleIds: string[];
}

export function DraftList({
  role,
  canEdit,
  drafts,
  totalDrafts
}: {
  role: string;
  canEdit: boolean;
  drafts: DraftRow[];
  /** How many drafts exist in total, versus the page actually rendered. */
  totalDrafts: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [transferFor, setTransferFor] = useState<DraftRow | null>(null);
  const [rowError, setRowError] = useState("");

  const deleteDraft = async (d: DraftRow) => {
    if (!window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    setRowError("");
    try {
      const res = await fetch(`/api/drafts/${d.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        setRowError(
          ((await res.json().catch(() => ({}))) as { error?: string }).error ??
            "Could not delete this draft."
        );
      }
    } catch {
      setRowError("Could not delete — check the connection and try again.");
    }
  };

  const createLike = async (moduleIds: string[], title: string) => {
    setBusy(true);
    setRowError("");
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, note: { selectedModuleIds: moduleIds, values: {} } })
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };
      router.push(`/note/${id}`);
    } catch {
      setBusy(false);
      setRowError("Could not create the note — check the connection and try again.");
    }
  };

  const statusCounts = useMemo(() => {
    const counts = new Map<DraftStatus, number>();
    for (const d of drafts) counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    return [...counts.entries()];
  }, [drafts]);

  const filtered = useMemo(
    () =>
      drafts.filter(
        (d) =>
          d.title.toLowerCase().includes(query.toLowerCase()) &&
          (!statusFilter || d.status === statusFilter)
      ),
    [drafts, query, statusFilter]
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {seesAllNotes(role as Role) ? "All Smile Notes" : "My Smile Notes"} ({filtered.length})
        </h2>
        <input
          type="search"
          className="field-input max-w-xs"
          placeholder="Search titles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search drafts by title"
        />
      </div>
      {/* Say it plainly when this is only part of the list. Search and the
          status chips filter the loaded page, not the whole table, so a
          silent cap would make a missing note look deleted. */}
      {totalDrafts > drafts.length && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Showing the {drafts.length} most recently updated of {totalDrafts} drafts. Older ones are
          not on this page — search and filters cover the ones shown.
        </p>
      )}
      {/* Keep this row mounted while a filter is active, even if the
          filtered status just lost its last draft (e.g. it was deleted) —
          otherwise "Clear filter" unmounts with the chips and the remaining
          drafts are invisible with no way to recover short of a reload. */}
      {(statusCounts.length > 1 || statusFilter !== null) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {statusCounts.map(([s, n]) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`tap rounded-full border px-3 text-xs font-medium ${
                statusFilter === s
                  ? "border-brand-blue bg-brand-blue text-white"
                  : STATUS_META[s].chipClass
              }`}
              title={`Show only ${STATUS_META[s].label.toLowerCase()} drafts`}
            >
              <span aria-hidden>{STATUS_META[s].icon}</span> {STATUS_META[s].short} ({n})
            </button>
          ))}
          {statusFilter && (
            <button
              type="button"
              className="text-xs text-slate-500 underline"
              onClick={() => setStatusFilter(null)}
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      {rowError && (
        <p className="mb-2 text-sm text-rose-700" role="alert">
          {rowError}
        </p>
      )}
      {filtered.length === 0 ? (
        drafts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Character id="sparkle" size="md" />
            <p className="text-sm text-slate-500">
              {canEdit
                ? `No Smile Notes yet. Start one on the Notes tab. ${sparkleLine("empty", daySeed(new Date()))}`
                : "No drafts to view yet."}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No drafts match your search.
          </p>
        )
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden p-0">
          {/* flex-wrap: the title link plus three shrink-0 action buttons
              cannot fit a phone on one line, and without wrapping they
              forced the page wider than the screen. */}
          {filtered.map((d) => (
            <li
              key={d.id}
              className="relative flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-5 pr-4 transition-colors duration-100 hover:bg-brand-cream/40"
            >
              {/* The rail repeats what the chip already says in a word and an
                  icon — it exists so a column of rows can be scanned without
                  reading, never as the only encoding. */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-1 ${STATUS_META[d.status].rail}`}
              />
              <Link
                href={`/note/${d.id}`}
                className="flex min-w-0 flex-1 basis-full items-center justify-between gap-3 sm:basis-auto"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{d.title}</span>
                  <span className="block text-xs text-slate-500">
                    Updated {d.updatedAtLabel}
                    {d.ownerName ? ` · ${d.ownerName}` : ""}
                  </span>
                </span>
                <StatusChip status={d.status} />
              </Link>
              {canTransferNotes(role as Role) && (
                <button
                  className="tap shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-blue/50 hover:text-brand-navy"
                  onClick={() => setTransferFor(d)}
                  title="Transfer ownership"
                >
                  Transfer
                </button>
              )}
              {canEdit && (
                <button
                  className="tap shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-blue/50 hover:text-brand-navy"
                  disabled={busy}
                  onClick={() => createLike(d.moduleIds, d.title)}
                  title="Start a new Smile Note with the same modules — no values are copied"
                  aria-label={`Start a new note like ${d.title}`}
                >
                  New like this
                </button>
              )}
              {canEdit && (
                <button
                  className="tap shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:border-rose-300 hover:bg-rose-50"
                  onClick={() => deleteDraft(d)}
                  title="Delete draft"
                  aria-label={`Delete ${d.title}`}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {transferFor && (
        <TransferDraftDialog
          draftId={transferFor.id}
          draftTitle={transferFor.title}
          onClose={() => setTransferFor(null)}
          onDone={() => {
            setTransferFor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
