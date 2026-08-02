"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@/components/ui/Dialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { QUICK_PICKS } from "@/lib/presets/quickPicks";
import { sparkleLine } from "@/lib/stats/sparkle";
import { BADGES } from "@/lib/stats/badges";
import type { UserStats } from "@/lib/stats/computeStats";
import type { DraftStatus } from "@/lib/status/draftStatus";

interface DraftRow {
  id: string;
  title: string;
  status: DraftStatus;
  ownerName?: string;
  updatedAt: string;
}

export function Dashboard({
  role,
  displayName,
  canEdit,
  drafts,
  stats
}: {
  role: string;
  displayName: string;
  canEdit: boolean;
  drafts: DraftRow[];
  stats: UserStats;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPicks, setShowPicks] = useState(false);
  const [transferFor, setTransferFor] = useState<DraftRow | null>(null);

  const filtered = useMemo(
    () => drafts.filter((d) => d.title.toLowerCase().includes(query.toLowerCase())),
    [drafts, query]
  );

  const createDraft = async (moduleIds: string[], title: string) => {
    setBusy(true);
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, note: { selectedModuleIds: moduleIds, values: {} } })
    });
    if (res.ok) {
      const { id } = (await res.json()) as { id: string };
      router.push(`/note/${id}`);
    } else {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {displayName} 👋</h1>
          <p className="text-sm text-slate-600">{sparkleLine("dashboard", drafts.length + stats.totalSubmitted)}</p>
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
              <div className="absolute right-0 z-10 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
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

      <StatsCard stats={stats} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {role === "user" ? "My drafts" : "All drafts"} ({filtered.length})
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
        {filtered.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {drafts.length === 0
              ? canEdit
                ? "No drafts yet. Start one with New note or a Quick pick."
                : "No drafts to view yet."
              : "No drafts match your search."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {filtered.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <Link href={`/note/${d.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{d.title}</span>
                    <span className="block text-xs text-slate-500">
                      Updated {new Date(d.updatedAt).toLocaleString()}
                      {d.ownerName ? ` · ${d.ownerName}` : ""}
                    </span>
                  </span>
                  <StatusChip status={d.status} />
                </Link>
                {role === "admin" && (
                  <button
                    className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => setTransferFor(d)}
                    title="Transfer ownership"
                  >
                    Transfer
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
    const res = await fetch(`/api/admin/drafts/${draft.id}/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toUserId })
    });
    if (res.ok) return onDone();
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Transfer failed.");
  };

  return (
    <Dialog title={`Transfer "${draft.title}"`} onClose={onClose}>
      <div className="space-y-3">
        <label className="field-label">Transfer to</label>
        <select className="field-input" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
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
      <div className="grid grid-cols-3 gap-4 text-center">
        <Stat label="Submitted" value={String(stats.totalSubmitted)} />
        <Stat label="First-pass" value={`${Math.round(stats.firstPassRate * 100)}%`} />
        <Stat label="Clean streak" value={String(stats.currentStreak)} />
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
