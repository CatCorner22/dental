"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { partitionIntoSoap, type SoapSection } from "@/lib/standardize/structure";
import { standardize } from "@/lib/standardize/standardize";
import { runTextAudit } from "@/lib/audit/engine";
import { SEVERITY_CHIP, SEVERITY_LABELS, SEVERITY_ORDER, SEVERITY_SHAPE } from "@/lib/audit/types";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import { TextDiff } from "@/components/diff/TextDiff";
import { HelpTip } from "@/components/ui/HelpTip";

// PASTE, AS AN ENTRY MODE.
//
// This is the other half of the merge. A note that already exists somewhere —
// typed in a hurry, dictated into a phone, carried over from a previous
// system — used to need a different page, which stored nothing and could not
// file. Now it comes in here and lands in the note.
//
// THE ONE RULE: nothing moves into a field unless a person puts it there.
//
// That is not caution for its own sake. Auto-placing prose into the structured
// fields would break the app in two specific ways. The required-field check
// only tests whether a value is EMPTY, so a paragraph dropped into "Diagnosis"
// satisfies an S1 gate with prose — a gate that opens for a paragraph is not a
// gate. And any write to a dentist-owned field by a hygienist or assistant is
// refused by the scope guard on the very first autosave, which the builder
// surfaces as a generic save error and then retries forever. So the sort is
// shown, the destinations are offered, and the writer chooses.
//
// The standardize pass and the text audit run live on the pasted text, client
// side, before any of it is committed — same functions the note itself is
// checked with, so what is promised here is what happens there.

const DESTINATIONS: { section: SoapSection; key: string; label: string }[] = [
  { section: "Safety", key: "universal-core.narrative-safety", label: "Safety and history" },
  {
    section: "Subjective",
    key: "universal-core.narrative-subjective",
    label: "What the patient reports"
  },
  {
    section: "Objective",
    key: "universal-core.narrative-objective",
    label: "What you observed and did"
  },
  { section: "Assessment", key: "universal-core.narrative-assessment", label: "Assessment" },
  { section: "Plan", key: "universal-core.narrative-plan", label: "Plan" }
];

export function PasteIntake({
  onSend,
  canEdit,
  lockedSections
}: {
  /** Append this text to that field. The builder owns the note; this only asks. */
  onSend: (fieldKey: string, text: string) => void;
  canEdit: boolean;
  /** Field keys this licence may not write. Offered as read-only, never as a button. */
  lockedSections: ReadonlySet<string>;
}) {
  const [raw, setRaw] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const deferred = useDeferredValue(raw);

  const review = useMemo(() => {
    const trimmed = deferred.trim();
    if (!trimmed) return null;
    const pass = standardize(trimmed);
    return {
      pass,
      findings: runTextAudit(pass.text),
      partitions: partitionIntoSoap(pass.text)
    };
  }, [deferred]);

  const send = (key: string, text: string) => {
    onSend(key, text);
    setSent((s) => ({ ...s, [key]: true }));
  };

  // No outer <details>. This component only mounts inside a Dialog that already
  // titles the surface ("Paste an existing note"). A second collapsed disclosure
  // left the dialog looking empty until another click — measured: writers opened
  // Paste and saw a header with no textarea.
  return (
    <div className="space-y-3">
        <p className="flex items-start gap-1.5 text-xs text-slate-600">
          <HelpTip label="About pasting a note">
            The wording pass and the same checks that run on the note itself run here first, and
            the sentences are sorted into sections so you can see where they land. Nothing is put
            into a field until you send it there.
          </HelpTip>
          <span>
            Wording checks run here first. Nothing lands in a field until you send it.
          </span>
        </p>
        <label className="field-label" htmlFor="paste-intake">
          Paste or type the note
        </label>
        <textarea
          id="paste-intake"
          className="field-input min-h-32"
          spellCheck={false}
          placeholder="Paste the note here. It stays in this box until you send a section into the note."
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={!canEdit}
        />
        {/* The privacy line belongs where the pasting happens, not in a page
            footer. What is typed here is not stored; what is SENT is, like any
            other edit to the note. */}
        <p className="text-xs text-slate-500">
          This box is not saved. Anything you send into the note is saved with the note — on the
          server, in its version history, and in the local backup — like any other edit.
        </p>

        {review === null ? null : (
          <>
            {review.pass.applied.length > 0 && (
              /* .card-inset is the defined level-2 surface — a block nested
                 inside a card — and it already carries this radius and padding,
                 so this is a 1:1 swap. It also picks up the ring bump that
                 [data-contrast="high"] applies to .card/.card-inset only, which
                 these hand-rolled boxes were silently missing. */
              <div className="card-inset">
                <p className="mb-1.5 text-xs font-semibold text-slate-700">
                  Wording this practice standardizes ({review.pass.applied.length})
                </p>
                <TextDiff before={review.pass.text === raw.trim() ? raw.trim() : deferred.trim()} after={review.pass.text} />
              </div>
            )}

            {review.findings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1.5 text-xs font-semibold text-amber-900">
                  {review.findings.length} thing{review.findings.length === 1 ? "" : "s"} the
                  checker would raise
                </p>
                <ul className="space-y-1">
                  {SEVERITY_ORDER.flatMap((sev) =>
                    review.findings
                      .filter((f) => f.severity === sev)
                      .slice(0, 6)
                      .map((f, i) => (
                        <li key={`${sev}-${i}`} className="text-xs text-slate-800">
                          <span
                            className={`mr-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${SEVERITY_CHIP[f.severity]}`}
                          >
                            <span aria-hidden="true">{SEVERITY_SHAPE[f.severity]} </span>
                            {SEVERITY_LABELS[f.severity]}
                          </span>
                          {f.message}
                        </li>
                      ))
                  )}
                </ul>
                <p className="mt-1.5 text-xs text-amber-900">
                  These are raised again on the note itself once the text is in it. Nothing is
                  fixed for you.
                </p>
              </div>
            )}

            {review.partitions.length === 0 ? (
              // structureIntoSoap declines on short notes, single-topic notes,
              // and notes that already carry headings. Showing an empty panel
              // would read as "the tool did nothing"; showing the text with one
              // destination is honest and still useful.
              <div className="card-inset">
                <p className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                  <Character id="sparkle" size="xs" />
                  Too short to sort into sections — here it is as one piece.
                </p>
                <SendRow
                  text={review.pass.text}
                  destinations={DESTINATIONS}
                  sent={sent}
                  onSend={send}
                  canEdit={canEdit}
                  lockedSections={lockedSections}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Character id="sparkle" size="xs" />
                  {sparkleLine("paste", daySeed(new Date()))}
                </p>
                {review.partitions.map((p) => {
                  const preferred = DESTINATIONS.find((d) => d.section === p.section);
                  return (
                    <div key={p.section} className="card-inset">
                      <p className="eyebrow mb-1">{p.section}</p>
                      <p className="mb-2 whitespace-pre-wrap text-sm text-slate-800">{p.text}</p>
                      <SendRow
                        text={p.text}
                        destinations={preferred ? [preferred, ...DESTINATIONS.filter((d) => d !== preferred)] : DESTINATIONS}
                        sent={sent}
                        onSend={send}
                        canEdit={canEdit}
                        lockedSections={lockedSections}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
    </div>
  );
}

function SendRow({
  text,
  destinations,
  sent,
  onSend,
  canEdit,
  lockedSections
}: {
  text: string;
  destinations: { section: SoapSection; key: string; label: string }[];
  sent: Record<string, boolean>;
  onSend: (key: string, text: string) => void;
  canEdit: boolean;
  lockedSections: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const first = destinations[0];
  const rest = destinations.slice(1);
  const firstLocked = lockedSections.has(first.key);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className="btn-secondary text-xs"
        disabled={!canEdit || firstLocked}
        title={
          firstLocked
            ? "The dentist records this section — send it to a field that is yours, or ask the dentist to complete it."
            : undefined
        }
        aria-describedby={firstLocked ? `paste-locked-${first.key}` : undefined}
        onClick={() => onSend(first.key, text)}
      >
        {/* The lock said out loud, exactly as the "somewhere else" buttons below
            already say it. This one carried the same condition in a title
            tooltip only — and `disabled` drops the button from the tab order, so
            a keyboard user could never surface it and a tablet has no hover at
            all. Same rule the rest of this cluster follows: a disabled control
            says why, next to itself. */}
        {sent[first.key] ? "Sent again →" : "Send to"} {first.label}
        {firstLocked ? " (dentist)" : ""}
      </button>
      {firstLocked && (
        /* basis-full so it takes its own row in the wrapping flex, and keyed by
           first.key because SendRow renders once per SOAP partition — a fixed id
           would collide across up to five rows and point aria-describedby at the
           wrong sentence. */
        <span id={`paste-locked-${first.key}`} className="basis-full text-xs text-slate-600">
          The dentist records this section — send it to a field that is yours, or ask the dentist
          to complete it.
        </span>
      )}
      {rest.length > 0 && (
        <>
          <button
            type="button"
            className="tap rounded px-2 py-1 text-xs font-semibold text-brand-blue hover:underline"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Somewhere else ▾
          </button>
          {open &&
            rest.map((d) => {
              const locked = lockedSections.has(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  className="tap rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  disabled={!canEdit || locked}
                  title={locked ? "The dentist records this section." : undefined}
                  onClick={() => onSend(d.key, text)}
                >
                  {d.label}
                  {locked ? " (dentist)" : ""}
                </button>
              );
            })}
        </>
      )}
    </div>
  );
}
