"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusChip } from "@/components/ui/StatusChip";
import { Character } from "@/components/mascot/Sparkle";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";
import { featuredPicksForRole, quickPicksForRole } from "@/lib/presets/quickPicks";
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
  const picksRef = useRef<HTMLDivElement>(null);
  const picks = useMemo(() => quickPicksForRole(clinicalRole), [clinicalRole]);
  const featured = useMemo(() => featuredPicksForRole(clinicalRole), [clinicalRole]);
  const featuredIds = useMemo(() => new Set(featured.map((p) => p.id)), [featured]);
  const morePicks = useMemo(
    () => picks.filter((p) => !featuredIds.has(p.id)),
    [picks, featuredIds]
  );
  const structureCue = authorCapabilities(clinicalRole).structureCue;

  // Escape + outside click — same pattern as NavMenu. Without this the picks
  // panel stays open over the note list after the next tap elsewhere, which
  // reads as a stuck overlay on a shared tablet (showtime residual).
  useEffect(() => {
    if (!showPicks) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowPicks(false);
      picksRef.current?.querySelector("button")?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      if (picksRef.current && !picksRef.current.contains(e.target as Node)) {
        setShowPicks(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [showPicks]);

  // NO TITLE ON THE WIRE, ON PURPOSE — NOT EVEN AN OPTIONAL ONE.
  //
  // Drafts name themselves date_Who_Where_time, and the server does it, but
  // only when the client sends no title: an explicit one is read as a person
  // naming their own note. This screen sent one every time — the literal
  // "Untitled note" from the blank button, and the scaffold's own label
  // ("Restoration", "Hygiene recall") from the Fast Lane picks — so the one
  // place in the app that starts most notes was also the one place that
  // defeated the naming, and a draft list came back reading "Untitled note",
  // "Untitled note", "Restoration", "Restoration".
  //
  // main reached the same conclusion for the scaffolds and left the parameter
  // in place for the blank button. It is gone entirely here, because
  // "Untitled note" is the string the auto-title exists to replace, and a
  // parameter that only one caller may pass is a parameter somebody will pass.
  const createDraft = async (moduleIds: string[]) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: { selectedModuleIds: moduleIds, values: {} } })
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
        <div className="relative" ref={picksRef}>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => setShowPicks((s) => !s)}
            aria-expanded={showPicks}
            aria-haspopup="menu"
          >
            Start another note ▾
          </button>
          {showPicks && (
            // Never wider than the screen: a fixed w-80 anchored right of a
            // narrower button computed a negative left edge on a phone, putting
            // the labels off-screen with no way to scroll to them (absolute
            // overflow to the left creates no scrollbar).
            <div
              role="menu"
              className="absolute left-0 right-0 z-10 mt-1 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200 sm:left-auto sm:w-80"
            >
              <button
                role="menuitem"
                className="block w-full rounded p-2 text-left hover:bg-brand-blue/10"
                disabled={busy}
                onClick={() => createDraft([])}
              >
                <span className="text-sm font-semibold text-slate-800">Blank note</span>
                <span className="block text-xs text-slate-500">Universal Core only.</span>
              </button>
              <p className="eyebrow mb-1 mt-2 border-t border-slate-100 px-2 pt-2">
                Fast Lane
              </p>
              <p className="mb-1 px-2 text-[0.7rem] leading-snug text-slate-500">
                {structureCue}
              </p>
              {featured.map((p) => (
                <button
                  role="menuitem"
                  key={p.id}
                  className="block w-full rounded p-2 text-left hover:bg-brand-blue/10"
                  disabled={busy}
                  onClick={() => createDraft(p.moduleIds)}
                >
                  <span className="text-sm font-semibold text-slate-800">{p.label}</span>
                  <span className="block text-xs text-slate-500">{p.description}</span>
                </button>
              ))}
              {morePicks.length > 0 && (
                <details className="mt-2 border-t border-slate-100 pt-2">
                  <summary className="label-micro tap cursor-pointer px-2 py-1 text-slate-500">
                    More scaffolds
                  </summary>
                  <div className="mt-1">
                    {morePicks.map((p) => (
                      <button
                        role="menuitem"
                        key={p.id}
                        className="block w-full rounded p-2 text-left hover:bg-brand-blue/10"
                        disabled={busy}
                        onClick={() => createDraft(p.moduleIds)}
                      >
                        <span className="text-sm font-semibold text-slate-800">{p.label}</span>
                        <span className="block text-xs text-slate-500">{p.description}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
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
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Character id="sparkle" size="xs" />
          Nothing else open.{" "}
          {totalDrafts > 0 ? (
            <Link href="/notes" className="font-semibold text-brand-blue hover:underline">
              See all {totalDrafts}
            </Link>
          ) : null}
        </p>
      ) : (
        <>
          <ul className="card divide-y divide-slate-100 overflow-hidden p-0">
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
