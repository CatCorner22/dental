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
    // ONE ROW, NOT FOUR CARDS.
    //
    // This shipped as a 2x2 grid of cards with a heading, a strapline, a
    // description per card and a call to action per card — about 290px sitting
    // between the top of the note and the first box you can type in, on every
    // new note. The whole point of the home page is that the cursor is already
    // in a clinical field; a scaffold picker is a convenience for the minority
    // of notes that want an add-on, and it was charging every note for it.
    //
    // Same picks, same one tap, same text in the tooltip. About 60px.
    <section className="card p-2.5" aria-label="Fast Lane visit scaffolds">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="eyebrow shrink-0">Fast Lane</span>
        {picks.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip"
            title={`${p.description} — adds the usual modules for this visit. Nothing clinical is filled in; you still write the findings.`}
            onClick={() => onApply(p)}
          >
            {p.label}
          </button>
        ))}
        <span className="basis-full text-[0.7rem] leading-snug text-slate-500">{cue}</span>
      </div>
    </section>
  );
}
