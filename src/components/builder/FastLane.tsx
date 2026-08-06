"use client";

import { useMemo } from "react";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";
import { featuredPicksForRole, type QuickPick } from "@/lib/presets/quickPicks";

/**
 * Progressive Fast Lane — structure scaffolds on the open note.
 *
 * Home is already the note (cursor in the first clinical field). Featured
 * visit cards therefore do NOT create a second draft or reintroduce the old
 * dashboard. They only add the right add-on modules (and a title if still
 * "Untitled note") so the writer skips hunting the module rail.
 *
 * Structure only. Never field values. Never clinical assertions.
 */
export function FastLane({
  clinicalRole,
  canEdit,
  visible,
  onApply
}: {
  clinicalRole: ClinicalRole;
  canEdit: boolean;
  /** Show only when the note is still Core-only (no add-ons yet). */
  visible: boolean;
  onApply: (pick: QuickPick) => void;
}) {
  const picks = useMemo(() => featuredPicksForRole(clinicalRole), [clinicalRole]);
  const cue = authorCapabilities(clinicalRole).structureCue;

  if (!canEdit || !visible || picks.length === 0) return null;

  return (
    <section
      className="card space-y-3 p-3"
      aria-label="Fast Lane visit scaffolds"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Fast Lane</p>
          <h2 className="section-title text-base">Common visit structure</h2>
        </div>
        <p className="max-w-md text-xs leading-snug text-slate-500">
          One tap adds the usual modules for that visit. Nothing clinical is
          filled in — you still write the findings.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {picks.map((p) => (
          <button
            key={p.id}
            type="button"
            className="fast-lane-card text-left"
            onClick={() => onApply(p)}
          >
            <span className="block text-sm font-semibold text-brand-navy">{p.label}</span>
            <span className="mt-0.5 block text-xs leading-snug text-slate-600">{p.description}</span>
            <span className="mt-2 inline-flex text-xs font-semibold text-brand-blue">
              Use this structure →
            </span>
          </button>
        ))}
      </div>
      <p className="text-[0.7rem] leading-snug text-slate-500">{cue}</p>
    </section>
  );
}
