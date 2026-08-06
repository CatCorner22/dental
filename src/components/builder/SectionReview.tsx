"use client";

import { useState } from "react";

import { TextDiff } from "@/components/diff/TextDiff";
import { severityLabel } from "@/lib/audit/types";
import type { SectionReview as Review } from "@/lib/review/sectionReview";

/**
 * THE END OF A SECTION.
 *
 * One button — "Check this section" — then everything the deterministic tools
 * have to say about it in one place, then accept or keep editing, then the next
 * section. This is the loop the note is written in.
 *
 * It exists because the alternative was asking a clinician to hold the whole
 * document in their head and decide for themselves when any part of it was
 * finished, with a live panel beside them changing as they typed. A note is
 * written in sections; the checking should happen in sections too.
 *
 * Everything shown here is a proposal. Nothing in this component writes to the
 * note except through onApply, and onApply only ever runs from a press.
 */
export function SectionReview({
  review,
  phase,
  hasNext,
  canEdit,
  onCheck,
  onApply,
  onAcceptAndContinue,
  onKeepEditing
}: {
  review: Review;
  /**
   * Where this section is in the loop.
   *   idle      — not checked yet; offer the button and say nothing else.
   *   reviewing — checked; the findings and proposals are on screen.
   *   checked   — accepted, and not edited since.
   */
  phase: "idle" | "reviewing" | "checked";
  /** Is there a section after this one, or is this the end of the note? */
  hasNext: boolean;
  canEdit: boolean;
  onCheck: () => void;
  /** Apply one proposed rewrite. */
  onApply: (fieldKey: string, text: string) => void;
  onAcceptAndContinue: () => void;
  onKeepEditing: () => void;
}) {
  // Which proposals the writer has already answered, so an accepted rewrite
  // stops being offered without the panel closing and losing their place.
  const [answered, setAnswered] = useState<Record<string, "applied" | "kept">>({});
  const open = review.proposals.filter((p) => !answered[p.fieldKey]);

  if (!canEdit) return null;

  if (phase === "checked") {
    return (
      <p className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-xs font-medium text-green-800">
        <span aria-hidden>✓</span> Checked. Edit anything here and it will ask again.
      </p>
    );
  }

  // Before the button is pressed there is nothing to say. A section that
  // announced its own findings unprompted would be the live-audit-beside-you
  // arrangement this replaces.
  if (phase === "idle") {
    return (
      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            // A fresh check must re-offer proposals. Leaving `answered` stuck
            // from a prior pass hid every rewrite after "Keep editing".
            setAnswered({});
            onCheck();
          }}
        >
          Check this section
        </button>
        <span className="ml-2 text-xs text-slate-500">
          Reads what you wrote here and shows anything worth a second look.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-3">
      <p className="text-sm font-semibold text-brand-navy">
        {review.clean
          ? "Nothing to raise in this section."
          : "Here is what the checks found in this section."}
      </p>

      {/* MISSING FIRST. An empty required field is the only thing here that
          stops the note being filed, so it goes above advice about wording. */}
      {review.openRequired.length > 0 && (
        <div className="rounded border border-orange-300 bg-orange-50 px-2.5 py-2">
          <p className="text-xs font-semibold text-orange-900">
            {review.openRequired.length} required field
            {review.openRequired.length === 1 ? "" : "s"} still empty
          </p>
          <ul className="mt-1 space-y-0.5">
            {review.openRequired.map((r) => (
              <li key={r.fieldKey} className="text-xs text-orange-900">
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PROPOSED WORDING, one decision at a time, each with its diff open.
          Accepting a rewrite of a clinical record on the strength of a summary
          is a guess; the words are shown. */}
      {open.map((p) => (
        <div key={p.fieldKey} className="rounded border border-slate-200 bg-white p-2.5">
          <p className="text-xs font-semibold text-slate-800">
            Suggested wording — {p.label}
          </p>
          <div className="mt-1.5">
            <TextDiff before={p.before} after={p.after} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => {
                onApply(p.fieldKey, p.after);
                setAnswered((a) => ({ ...a, [p.fieldKey]: "applied" }));
              }}
            >
              Use this wording
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setAnswered((a) => ({ ...a, [p.fieldKey]: "kept" }))}
            >
              Keep mine
            </button>
          </div>
        </div>
      ))}

      {review.findings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2">
          <p className="text-xs font-semibold text-amber-950">
            {review.findings.length} to look at — advice, not a block
          </p>
          <ul className="mt-1 space-y-1">
            {review.findings.map((f, i) => (
              <li key={i} className="text-xs text-amber-950">
                <span className="font-semibold">{severityLabel(f.severity)}:</span> {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-brand-blue/20 pt-2.5">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={review.blocked}
          aria-describedby={review.blocked ? "section-blocked" : undefined}
          onClick={onAcceptAndContinue}
        >
          {hasNext ? "Accept and go to the next section" : "Accept — this is the last section"}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            setAnswered({});
            onKeepEditing();
          }}
        >
          Keep editing this one
        </button>
        {/* The disabled button says why, next to itself, rather than in a
            tooltip no tablet and no keyboard user ever sees. */}
        {review.blocked && (
          <span id="section-blocked" className="text-xs text-orange-900">
            Fill the required fields above first.
          </span>
        )}
      </div>
    </div>
  );
}
