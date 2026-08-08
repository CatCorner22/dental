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

/**
 * Progressive Fast Lane — structure scaffolds on the open note.
 *
 * Published packs re-order featured picks and boost Section starters elsewhere.
 * They do NOT dump pack text here. After apply, BuilderShell may offer optional
 * attested pack starters (Yes / Not now) — still per-block confirm, never silent.
 * My blocks live on builder chrome above this strip (PinnedMyBlocks) — not here.
 */
export function FastLane({
  clinicalRole,
  canEdit,
  visible,
  practicePacks = [],
  onApply
}: {
  clinicalRole: ClinicalRole;
  canEdit: boolean;
  /** Show only when the note is still Core-only (no add-ons yet). */
  visible: boolean;
  practicePacks?: readonly PublishedPackLite[];
  onApply: (pick: QuickPick) => void;
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

  if (!canEdit || !visible) return null;

  if (picks.length === 0) return null;

  return (
    <section className="card p-2.5" aria-label="Fast Lane visit scaffolds">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="eyebrow shrink-0">Fast Lane</span>
        {picks.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip"
            title={`${p.description} — adds modules only. Nothing clinical is filled in. Matching packs may offer attested starters next.`}
            onClick={() => onApply(p)}
          >
            {p.label}
          </button>
        ))}
        <span className="sr-only">{cue}</span>
      </div>
      {/* Visible on touch — title= never appears on a tablet finger (UIX-006). */}
      <p className="mt-1.5 text-xs leading-snug text-slate-600">
        Adds visit modules only — nothing clinical is filled in. Matching practice packs may offer
        attested starters next; section starters also stay under Care delivered and Handoff.
      </p>
    </section>
  );
}
