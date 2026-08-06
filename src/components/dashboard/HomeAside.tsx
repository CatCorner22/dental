"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusChip } from "@/components/ui/StatusChip";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";
import { quickPicksForRole } from "@/lib/presets/quickPicks";
import type { DraftStatus } from "@/lib/status/draftStatus";

export interface RecentRow {
  id: string;
  title: string;
  status: DraftStatus;
  ownerName?: string;
  updatedAtLabel: string;
}

// WHAT SITS UNDER THE NOTE ON THE HOME PAGE.
//
// Deliberately small, and deliberately BELOW the builder. Everything here is a
// way of leaving the note you are in the middle of, so none of it belongs
// between signing in and writing.
//
// The four featured quick-pick tiles are gone. They existed to get you into a
// note in one click, and the note is now already open — so the only thing left
// worth offering is starting a DIFFERENT one, which is one control, not four
// tiles and a popover competing with the work.
export function HomeAside({
  recent,
  totalDrafts,
  clinicalRole,
  currentDraftId
}: {
  recent: RecentRow[];
  totalDrafts: number;
  clinicalRole: ClinicalRole;
  /** The note open above. It is listed, but never as somewhere to go. */
  currentDraftId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPicks, setShowPicks] = useState(false);
  const [error, setError] = useState("");
  const picks = useMemo(() => quickPicksForRole(clinicalRole), [clinicalRole]);
  const structureCue = authorCapabilities(clinicalRole).structureCue;

  const createDraft = async (moduleIds: string[], title: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, note: { selectedModuleIds: moduleIds, values: {} } })
      });
      if (!res.ok) {
        // Two real server refusals used to have no path to the screen at all:
        // the per-user draft cap (409) and the scope guard (403). Silently
        // doing nothing on either is how someone concludes the button is broken.
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setBusy(false);
        setError(body.error ?? "Could not start a new note — try again in a moment.");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/note/${id}`);
    } catch {
      setBusy(false);
      setError("Could not start a new note — check the connection and try again.");
    }
  };

  const others = recent.filter((d) => d.id !== currentDraftId);

  return (
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Other notes</h2>
        <div className="relative">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => setShowPicks((s) => !s)}
            aria-expanded={showPicks}
          >
            Start another note ▾
          </button>
          {showPicks && (
            // Never wider than the screen: a fixed w-80 anchored right of a
            // narrower button computed a negative left edge on a phone, putting
            // the labels off-screen with no way to scroll to them (absolute
            // overflow to the left creates no scrollbar).
            <div className="absolute left-0 right-0 z-10 mt-1 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200 sm:left-auto sm:w-80">
              <button
                className="block w-full rounded p-2 text-left hover:bg-brand-blue/10"
                disabled={busy}
                onClick={() => createDraft([], "Untitled note")}
              >
                <span className="text-sm font-semibold text-slate-800">Blank note</span>
                <span className="block text-xs text-slate-500">Universal Core only.</span>
              </button>
              <p className="mb-1 mt-2 border-t border-slate-100 px-2 pt-2 text-[0.7rem] leading-snug text-slate-500">
                {structureCue}
              </p>
              {picks.map((p) => (
                <button
                  key={p.id}
                  className="block w-full rounded p-2 text-left hover:bg-brand-blue/10"
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
      </div>

      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      {others.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing else open. {totalDrafts > 0 ? <Link href="/notes" className="font-semibold text-brand-blue hover:underline">See all {totalDrafts}</Link> : null}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {others.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/note/${d.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{d.title}</span>
                    <span className="block text-xs text-slate-500">
                      Updated {d.updatedAtLabel}
                      {d.ownerName ? ` · ${d.ownerName}` : ""}
                    </span>
                  </span>
                  <StatusChip status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notes" className="text-sm font-semibold text-brand-blue hover:underline">
            See all {totalDrafts} →
          </Link>
        </>
      )}
    </section>
  );
}
