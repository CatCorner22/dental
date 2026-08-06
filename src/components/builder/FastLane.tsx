"use client";

import { useMemo } from "react";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";
import { featuredPicksForRole, type QuickPick } from "@/lib/presets/quickPicks";
import {
  orderPicksByPackModules,
  packPreferredModuleIds,
  type PublishedPackLite
} from "@/lib/packs/publishedForVisit";
import { PinnedMyBlocks } from "./PinnedMyBlocks";

/**
 * Progressive Fast Lane — structure scaffolds on the open note.
 *
 * Published packs re-order featured picks and boost Section starters elsewhere.
 * They do NOT add a pack-browser chip wall here. My blocks is one closed chip
 * in this strip — not a second card.
 */
export function FastLane({
  clinicalRole,
  canEdit,
  visible,
  practicePacks = [],
  onApply,
  onInsertMyBlock
}: {
  clinicalRole: ClinicalRole;
  canEdit: boolean;
  /** Show only when the note is still Core-only (no add-ons yet). */
  visible: boolean;
  practicePacks?: readonly PublishedPackLite[];
  onApply: (pick: QuickPick) => void;
  onInsertMyBlock: (text: string) => void;
}) {
  const preferredModules = useMemo(
    () => packPreferredModuleIds(practicePacks, clinicalRole),
    [practicePacks, clinicalRole]
  );
  const picks = useMemo(
    () => orderPicksByPackModules(featuredPicksForRole(clinicalRole), preferredModules),
    [clinicalRole, preferredModules]
  );
  const cue = authorCapabilities(clinicalRole).structureCue;

  if (!canEdit) return null;

  // After Fast Lane applies, keep My blocks as a lone chip (no empty Fast Lane card).
  if (!visible) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PinnedMyBlocks canEdit={canEdit} onInsert={onInsertMyBlock} />
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PinnedMyBlocks canEdit={canEdit} onInsert={onInsertMyBlock} />
      </div>
    );
  }

  return (
    <section className="card p-2.5" aria-label="Fast Lane visit scaffolds">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="eyebrow shrink-0">Fast Lane</span>
        {picks.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip"
            title={`${p.description} — adds modules only. Nothing clinical is filled in. Open Care delivered or Handoff for Section starters.`}
            onClick={() => onApply(p)}
          >
            {p.label}
          </button>
        ))}
        <PinnedMyBlocks canEdit={canEdit} onInsert={onInsertMyBlock} />
        <span className="sr-only">{cue}</span>
      </div>
      {/* Visible on touch — title= never appears on a tablet finger (UIX-006). */}
      <p className="mt-1.5 text-[0.65rem] leading-snug text-slate-500">
        Adds visit modules only — nothing clinical is filled in. Open Care delivered or Handoff for
        Section starters.
      </p>
    </section>
  );
}
