"use client";

import { useMemo, useState } from "react";
import { seesAllNotes, type Role } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";
import { featuredPicksForRole, quickPicksForRole } from "@/lib/presets/quickPicks";
import { HelpTip } from "@/components/ui/HelpTip";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { GreetingBar } from "./GreetingBar";
import type { DraftRow } from "@/components/notes/DraftList";

export function Dashboard({
  role,
  clinicalRole = "unset",
  displayName,
  username,
  canEdit,
  drafts,
  totalDrafts
}: {
  role: string;
  /** TN clinical license — scopes Quick picks and structure cues. */
  clinicalRole?: ClinicalRole;
  displayName: string;
  /** Stable key for per-user client-side state (onboarding checklist). */
  username: string;
  canEdit: boolean;
  drafts: DraftRow[];
  // How many drafts exist in total, versus the page actually rendered.
  totalDrafts: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPicks, setShowPicks] = useState(false);
  const scopePicks = useMemo(() => quickPicksForRole(clinicalRole), [clinicalRole]);
  const featuredPicks = useMemo(() => featuredPicksForRole(clinicalRole), [clinicalRole]);
  const structureCue = authorCapabilities(clinicalRole).structureCue;
  const [rowError, setRowError] = useState("");

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
      {canEdit && <OnboardingChecklist username={username} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <GreetingBar displayName={displayName} />
        {canEdit && (
          <div className="relative">
            <div className="flex items-center gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => createDraft([], "Untitled note")}>
                + New Smile Note
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => setShowPicks((s) => !s)} aria-expanded={showPicks}>
                Quick picks ▾
              </button>
              <HelpTip label="About New Smile Note and Quick picks">
                New Smile Note opens a blank draft with Universal Core. Quick picks pre-select the
                modules for a common visit type matched to your clinical role so you spend less time
                ticking boxes outside your license.
              </HelpTip>
            </div>
            {showPicks && (
              // Never wider than the screen: a fixed w-80 anchored right of a
              // narrower button group computed a negative left edge on a
              // phone, putting the labels off-screen with no way to scroll to
              // them (absolute overflow to the left creates no scrollbar).
              <div className="absolute left-0 right-0 z-10 mt-1 max-w-[calc(100vw-2rem)] rounded-xl bg-white ring-1 ring-slate-200 p-2 shadow-lg sm:left-auto sm:w-80">
                <p className="mb-1 px-2 text-[0.7rem] leading-snug text-slate-500">{structureCue}</p>
                {scopePicks.map((p) => (
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
        )}
      </div>

      {rowError && (
        <p className="text-sm text-rose-700" role="alert">
          {rowError}
        </p>
      )}

      {canEdit && (
        /* Role-scoped visit scaffolds. Affordance comes from motion and the
           arrow, not from a repeated caption. */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {featuredPicks.map((p) => (
            <button
              key={p.id}
              className="group relative overflow-hidden rounded-xl bg-white p-4 text-left shadow-[0_1px_3px_rgba(59,43,102,0.08),0_1px_2px_rgba(59,43,102,0.04)] ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-blue/60 disabled:opacity-50 disabled:hover:translate-y-0"
              disabled={busy}
              onClick={() => createDraft(p.moduleIds, p.label)}
            >
              {/* Brand chrome, not state: the top rail lights on hover to say
                  "this is the one you are about to press". */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-blue to-brand-teal opacity-0 transition-opacity group-hover:opacity-100"
              />
              <span className="block text-sm font-semibold text-brand-navy">{p.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600">{p.description}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue">
                Start now
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      )}

      {resumeDraft && (
        <Link
          href={`/note/${resumeDraft.id}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-4 py-2.5 hover:bg-brand-blue/20"
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

      {/* No scoreboard here on purpose. First-pass rates, streaks, ranks, GPA,
          and badge strips turn a shared charting tool into hallway comparison —
          the job of this screen is to start or resume a note in one click. */}

      {/* A glance, not a list. Search, status filters and the per-row actions
          live on /notes now; what belongs on the screen you start work from is
          "do I already have something open, and how much is there". */}
      {drafts.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {seesAllNotes(role as Role) ? "Recent Smile Notes" : "My recent Smile Notes"}
            </h2>
            <Link href="/notes" className="text-sm font-semibold text-brand-blue hover:underline">
              See all {totalDrafts} →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {drafts.slice(0, 3).map((d) => (
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
        </div>
      )}
    </div>
  );
}
