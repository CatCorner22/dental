"use client";

import { useEffect, useMemo, useState } from "react";
import { canTransferNotes, seesAllNotes, type Role } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@/components/ui/Dialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { FEATURED_PICK_IDS, QUICK_PICKS } from "@/lib/presets/quickPicks";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import { BADGES } from "@/lib/stats/badges";
import { STATUS_META } from "@/lib/status/draftStatus";
import type { UserStats } from "@/lib/stats/computeStats";
import type { DraftStatus } from "@/lib/status/draftStatus";

interface DraftRow {
  id: string;
  title: string;
  status: DraftStatus;
  ownerName?: string;
  mine: boolean;
  updatedAtLabel: string; // pre-formatted server-side (hydration-safe)
  moduleIds: string[];
}

export function Dashboard({
  role,
  displayName,
  canEdit,
  drafts,
  stats,
  totalDrafts
}: {
  role: string;
  displayName: string;
  canEdit: boolean;
  drafts: DraftRow[];
  stats: UserStats;
  // How many drafts exist in total, versus the page actually rendered.
  totalDrafts: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPicks, setShowPicks] = useState(false);
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
        setRowError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not delete this draft.");
      }
    } catch {
      setRowError("Could not delete — check the connection and try again.");
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

  // The list is newest-activity-first, so the first unsubmitted draft the
  // viewer OWNS is "where you left off" — an admin's all-drafts view must
  // not present a teammate's note as theirs.
  const resumeDraft = useMemo(
    () => (canEdit ? drafts.find((d) => d.mine && d.status !== "submitted") : undefined),
    [drafts, canEdit]
  );

  const createDraft = async (moduleIds: string[], title: string) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {displayName} 👋</h1>
          <p className="text-sm text-slate-600">{sparkleLine("dashboard", daySeed(new Date()))}</p>
        </div>
        {canEdit && (
          <div className="relative">
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => createDraft([], "Untitled note")}>
                + New note
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => setShowPicks((s) => !s)} aria-expanded={showPicks}>
                Quick picks ▾
              </button>
            </div>
            {showPicks && (
              // Never wider than the screen: a fixed w-80 anchored right of a
              // narrower button group computed a negative left edge on a
              // phone, putting the labels off-screen with no way to scroll to
              // them (absolute overflow to the left creates no scrollbar).
              <div className="absolute left-0 right-0 z-10 mt-1 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-2 shadow-lg sm:left-auto sm:w-80">
                {QUICK_PICKS.map((p) => (
                  <button
                    key={p.id}
                    className="block w-full rounded p-2 text-left hover:bg-blue-50"
                    disabled={busy}
                    onClick={() => createDraft(p.moduleIds, p.label)}
                  >
                    <span className="text-sm font-semibold text-slate-800">{p.label}</span>
                    <span className="block text-xs text-slate-500">{p.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_PICKS.filter((p) => (FEATURED_PICK_IDS as readonly string[]).includes(p.id)).map((p) => (
            <button
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => createDraft(p.moduleIds, p.label)}
              title={p.description}
            >
              <span className="block text-sm font-semibold text-slate-800">{p.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">One click — start now</span>
            </button>
          ))}
        </div>
      )}

      {resumeDraft && (
        <Link
          href={`/note/${resumeDraft.id}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 hover:bg-blue-100"
        >
          {/* `truncate` needs a block box — on an inline span the browser
              honours only its `white-space: nowrap`, so a long user-typed
              title never wraps AND never ellipsises, and pushes the page
              wider than the screen instead. */}
          <span className="min-w-0 flex-1 text-sm text-slate-700">
            <span className="font-semibold">Continue where you left off:</span>{" "}
            <span className="block truncate">{resumeDraft.title}</span>
          </span>
          <StatusChip status={resumeDraft.status} />
        </Link>
      )}

      <StatsCard stats={stats} />

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
            Showing the {drafts.length} most recently updated of {totalDrafts} drafts. Older ones
            are not on this page — search and filters cover the ones shown.
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
                  statusFilter === s ? "border-blue-700 bg-blue-700 text-white" : STATUS_META[s].chipClass
                }`}
                title={`Show only ${STATUS_META[s].label.toLowerCase()} drafts`}
              >
                <span aria-hidden>{STATUS_META[s].icon}</span> {STATUS_META[s].short} ({n})
              </button>
            ))}
            {statusFilter && (
              <button type="button" className="text-xs text-slate-500 underline" onClick={() => setStatusFilter(null)}>
                Clear filter
              </button>
            )}
          </div>
        )}
        {rowError && <p className="mb-2 text-sm text-rose-700" role="alert">{rowError}</p>}
        {filtered.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {drafts.length === 0
              ? canEdit
                ? `No drafts yet. Start one with New note or a Quick pick. ${sparkleLine("empty", daySeed(new Date()))}`
                : "No drafts to view yet."
              : "No drafts match your search."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* flex-wrap: the title link plus three shrink-0 action buttons
                cannot fit a phone on one line, and without wrapping they
                forced the page wider than the screen. */}
            {filtered.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-slate-50">
                <Link href={`/note/${d.id}`} className="flex min-w-0 flex-1 basis-full items-center justify-between gap-3 sm:basis-auto">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{d.title}</span>
                    <span className="block text-xs text-slate-500">
                      Updated {d.updatedAtLabel}
                      {d.ownerName ? ` · ${d.ownerName}` : ""}
                    </span>
                  </span>
                  <StatusChip status={d.status} />
                </Link>
                {canTransferNotes(role as Role) && (
                  <button
                    className="tap shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => setTransferFor(d)}
                    title="Transfer ownership"
                  >
                    Transfer
                  </button>
                )}
                {canEdit && (
                  <button
                    className="tap shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50"
                    disabled={busy}
                    onClick={() => createDraft(d.moduleIds, d.title)}
                    title="Start a new note with the same modules — no values are copied"
                    aria-label={`Start a new note like ${d.title}`}
                  >
                    New like this
                  </button>
                )}
                {canEdit && (
                  <button
                    className="tap shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
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
      </div>

      {transferFor && (
        <TransferDialog
          draft={transferFor}
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

function TransferDialog({
  draft,
  onClose,
  onDone
}: {
  draft: DraftRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; username: string; displayName: string; role: string; active: boolean }[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers((d.users ?? []).filter((u: { active: boolean; role: string }) => u.active && u.role !== "readonly")))
      .catch(() => setError("Could not load users."));
  }, []);

  const submit = async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/drafts/${draft.id}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toUserId })
      });
      if (res.ok) return onDone();
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Transfer failed.");
    } catch {
      setError("Transfer failed — check the connection and try again.");
    }
  };

  return (
    <Dialog title={`Transfer "${draft.title}"`} onClose={onClose}>
      <div className="space-y-3">
        <label className="field-label" htmlFor="transfer-to">Transfer to</label>
        <select id="transfer-to" className="field-input" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
          <option value="">— select a user —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName} ({u.username})</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!toUserId} onClick={submit}>Transfer</button>
        </div>
      </div>
    </Dialog>
  );
}

function StatsCard({ stats }: { stats: UserStats }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-2 text-center text-xs text-slate-400">
        Every clean note helps the whole team. 🦷
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Stat label="Submitted" value={String(stats.totalSubmitted)} />
        <Stat label="First-pass" value={`${Math.round(stats.firstPassRate * 100)}%`} />
        <Stat
          label="Clean streak"
          value={`${stats.currentStreak}${stats.currentStreak >= 3 ? " 🔥" : ""}`}
        />
      </div>
      {stats.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {stats.badges.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs" title={BADGES[id].description}>
              <span aria-hidden>{BADGES[id].icon}</span>
              {BADGES[id].name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}
