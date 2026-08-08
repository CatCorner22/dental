"use client";

import { useRef, useState } from "react";
import type {
  Field,
  FieldValue,
  MeasurementField,
  MultiselectField,
  SelectField,
  TextField,
  TextareaField
} from "@/lib/schema/types";
import { standardize } from "@/lib/standardize/standardize";
import { OMISSION_LICENCES, exactLicence, licenceText } from "@/lib/audit/omissions";
import { TextDiff } from "@/components/diff/TextDiff";
import { ApplyWithReadback } from "@/components/builder/ReadbackConfirm";
import { DictationField } from "./DictationField";
import { BlockChips } from "./BlockChips";

interface InputProps<F extends Field, V extends FieldValue> {
  field: F;
  value: V | undefined;
  onChange: (value: FieldValue) => void;
  describedBy?: string;
  invalid?: boolean;
  // id of the primary control, so the visible <label htmlFor> names it for
  // screen readers. Group-style controls use aria-label instead.
  id?: string;
  /**
   * Does the audit insist on this field right now? Only the free-text inputs use
   * it, and only to offer the named omission licences — the shortcut the audit
   * already sanctions and counts, which until now the writer had to type by hand.
   * Declared on the shared props so NoteForm can pass it once for every field.
   */
  required?: boolean;
}

// Shared a11y attributes for the primary control of each field.
function aria(describedBy?: string, invalid?: boolean) {
  return {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": invalid ? true : undefined
  };
}

// Short single-choice lists render as one-click buttons instead of a
// two-click dropdown (open, then choose) — the recall-day click saver.
// "Other — specify" lists keep the dropdown so the free-text flow is clear.
export function isSegmentedSelect(field: SelectField): boolean {
  return field.options.length <= 4 && !field.allowOther;
}

export function SelectInput({ field, value, onChange, describedBy, invalid, id }: InputProps<SelectField, Extract<FieldValue, { kind: "select" }>>) {
  const current = value?.value ?? "";
  // A stored value that is not one of the (few) options — e.g. after a schema
  // change removed it — would be invisible in the segmented view and unable to
  // be cleared. Fall back to the dropdown so it stays visible and selectable.
  const strayValue = current !== "" && !field.options.some((o) => o.value === current);

  if (isSegmentedSelect(field) && !strayValue) {
    return (
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={field.label}
        aria-describedby={describedBy || undefined}
      >
        {field.options.map((o) => {
          const on = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ kind: "select", value: on ? "" : o.value })}
              // These chips ARE the note: nearly every clinical value is picked
              // here. Sized for a finger below sm, unchanged on desktop.
              className={`tap rounded-full border px-3 text-xs font-medium ${
                on
                  ? "border-brand-blue bg-brand-blue text-white"
                  : `bg-white text-slate-700 hover:bg-brand-blue/10 ${invalid ? "border-rose-400" : "border-slate-300"}`
              }`}
            >
              {o.label ?? o.value}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <select
        id={id}
        className="field-input"
        value={current}
        // The stray-value fallback reaches here for a SEGMENTED field, whose
        // visible label has no htmlFor (controlId returned undefined for it).
        // Give the control its name directly so it is never unlabeled.
        aria-label={id ? undefined : field.label}
        {...aria(describedBy, invalid)}
        onChange={(e) => onChange({ kind: "select", value: e.target.value, otherText: value?.otherText })}
      >
        <option value="">— select —</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label ?? o.value}
          </option>
        ))}
        {field.allowOther && <option value="__other__">Other — specify</option>}
      </select>
      {current === "__other__" && (
        <input
          type="text"
          className="field-input mt-1"
          placeholder="Name it exactly"
          aria-label={`${field.label} — other, name it exactly`}
          value={value?.otherText ?? ""}
          onChange={(e) => onChange({ kind: "select", value: "__other__", otherText: e.target.value })}
        />
      )}
    </div>
  );
}

export function MultiselectInput({ field, value, onChange, describedBy }: InputProps<MultiselectField, Extract<FieldValue, { kind: "multiselect" }>>) {
  const selected = value?.values ?? [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange({ kind: "multiselect", values: next });
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={field.label} aria-describedby={describedBy || undefined}>
      {field.options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={selected.includes(o.value)}
          onClick={() => toggle(o.value)}
          // These chips ARE the note: nearly every clinical value is picked
              // here. Sized for a finger below sm, unchanged on desktop.
              className={`tap rounded-full border px-3 text-xs font-medium ${
            selected.includes(o.value)
              ? "border-brand-blue bg-brand-blue text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-brand-blue/10"
          }`}
        >
          {o.label ?? o.value}
        </button>
      ))}
    </div>
  );
}

// THE SANCTIONED SHORTCUT, MADE CLICKABLE.
//
// `src/lib/audit/omissions.ts` already decided the hard part: an absence may be
// recorded, the ways of recording it are a finite named set, and the note carries
// how many it used. What that file could not do from where it sits is make the
// escape as CHEAP as the failure it exists to prevent.
//
// Until now the licence lived in prose inside an error message — "Enter the fact,
// or state not assessed, not applicable, unknown, or unresolved" — which means a
// writer on a required field had to TYPE it. Typing four words is slower than
// typing a plausible-sounding clinical fact, so the tool was, in the only currency
// a busy clinician spends, cheaper to fabricate into than to be honest with. That
// is the exact inversion the licences were designed to prevent, sitting in the
// interaction layer where the design never reached.
//
// Three rules hold this to its purpose:
//
//  1. REQUIRED FIELDS ONLY. A licence in an optional field is a writer being
//     helpfully explicit, not a shortcut, and `omissionReport` does not count it.
//     Offering it there would add noise and teach the chips mean nothing.
//  2. EMPTY OR ALREADY-A-LICENCE ONLY (see `exactLicence`). Prose is never one
//     click from gone.
//  3. AFTER the standard phrases, never before. The fact is the first thing
//     offered; the absence is the second. Both are one click, and the ORDER is
//     the whole nudge — this must never become a gate, and it must never become
//     the path of least resistance either.
//
// What the chip writes is a sentence ("Not applicable."), not a UI label, because
// a one-click licence must be indistinguishable in the record from a typed one.
function LicenceChips({ value, onPick }: { value: string; onPick: (text: string) => void }) {
  const active = exactLicence(value);
  // Rule 2, enforced here rather than trusted to the caller.
  if (value.trim() && !active) return null;

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Record this as an absence">
        <span className="text-xs text-slate-500">or record an absence:</span>
        {OMISSION_LICENCES.map((l) => {
          const on = active?.id === l.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              // Pressing the active chip clears the field, the same toggle-off the
              // segmented select uses above. A licence chosen by mistake must be
              // undoable by the same gesture that chose it.
              onClick={() => onPick(on ? "" : licenceText(l))}
              title={l.means}
              className={`tap rounded-full border px-3 text-xs font-medium ${
                on
                  ? "border-amber-700 bg-amber-700 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-amber-50"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      {/*
        WHAT YOU JUST ASSERTED, said out loud.

        omissions.ts is emphatic that these five are not interchangeable — "not
        applicable" says the question does not arise, "unknown" says someone looked
        and could not find out — and that "a later reader who cannot tell them apart
        has learned nothing from any of them". A row of chips with no meanings
        attached would get the first one clicked every time, which would satisfy the
        gate while destroying the distinction the set exists to preserve.
      */}
      {active && (
        <p className="mt-1 text-xs text-amber-800" role="status">
          {active.means} This counts as a recorded absence, not an answer.
        </p>
      )}
    </div>
  );
}

function PhraseChips({ phrases, onInsert }: { phrases: string[]; onInsert: (phrase: string) => void }) {
  if (phrases.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {phrases.map((p) => (
        <button key={p} type="button" className="chip" title="Insert standard phrase at the cursor" onClick={() => onInsert(p)}>
          {p.length > 60 ? `${p.slice(0, 57)}…` : p}
        </button>
      ))}
    </div>
  );
}


// The transformer, inline on every free-text field.
//
// "Writing on rails" used to mean going somewhere else to get standard wording.
// Here it is one button beside the box you are already typing in, so the rails
// are where the writing happens. Same pure module as the standalone page and
// the same rule: deterministic rewrites are applied, judgement calls are shown
// and left alone.
//
// Runs entirely in the browser — the module imports only vocabulary tables, no
// database and no network — so it is instant, works offline, and the text never
// leaves the page.
function StandardizeField({
  text,
  onApply,
  caution
}: {
  text: string;
  onApply: (next: string) => void;
  /** Shown before the button is pressed, when this field is a poor fit for it. */
  caution?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  // What the writer had before the button rewrote it, and what the button
  // produced. Both, because Undo is only offered while the field still holds
  // exactly what was produced — see below.
  const [prior, setPrior] = useState<{ before: string; after: string } | null>(null);
  // A rewrite that has been COMPUTED but not accepted. This is the whole
  // "are you sure" — the deterministic pass proposes into here, and only the
  // writer pressing Apply moves it into the note.
  const [pending, setPending] = useState<{ before: string; after: string } | null>(null);
  // The diff is opt-in per run rather than always-on: it is the answer to "what
  // did you just do", and pinning it open would push the next field off screen
  // on a busy note.
  const [showDiff, setShowDiff] = useState(false);
  if (!text.trim()) return null;

  // The writer has typed since the rewrite, so their newer words are what is in
  // the box. Restoring `before` now would throw those away, which is the same
  // kind of unasked-for edit Undo exists to reverse. The offer simply expires.
  const canUndo = prior !== null && text === prior.after;

  const run = () => {
    const r = standardize(text);
    // NEVER write back a truncated result. The transform only read the first
    // 20,000 characters, so applying it would silently delete everything past
    // that — and ensureTerminalPeriod would put a full stop on the cut, so the
    // note would even LOOK finished. A six-second toast is not consent to
    // destroy the end of a clinical note.
    if (r.truncated) {
      setNote("⚠ too long to standardize — nothing was changed. Shorten the field or standardize it in sections.");
      return;
    }
    // PROPOSE. DO NOT APPLY.
    //
    // This used to rewrite the field on the spot and offer Undo afterwards,
    // which asks a clinician to notice an unrequested edit to a legal record
    // and object to it. The burden is the wrong way round: the deterministic
    // pass is very good, and "very good" is still not consent. Nothing reaches
    // the note now until somebody reads the diff and says yes.
    if (r.text !== text) {
      setPending({ before: text, after: r.text });
      setShowDiff(true);
    }
    const parts: string[] = [];
    // Loudest first: something was LOST, which matters more than what changed.
    const changes = r.applied.filter((a) => a.kind !== "formatting").length;
    if (r.text !== text) {
      parts.push(
        changes > 0 ? `${changes} change${changes === 1 ? "" : "s"} proposed` : "tidying proposed"
      );
    }
    if (r.flags.length > 0) {
      // Named, not just counted: "1 needs your judgement" tells the writer
      // nothing about WHICH word to look at.
      parts.push(`your call: ${r.flags.map((f) => f.display).join(", ")}`);
    }
    setNote(parts.length ? parts.join(" · ") : "already standard");
    // Cleared on a timer only for the ordinary "here is what changed"
    // message. The truncation refusal above returns early and stays put.
    setTimeout(() => setNote(null), 6000);
  };

  return (
    // Shares a line with the other chips when it is only a chip; takes the
    // whole width the moment it has a diff, a caution or an outcome to show.
    <div
      className={`mt-1 flex flex-wrap items-center gap-2${
        pending || note || prior || caution ? " w-full" : ""
      }`}
    >
      <button
        type="button"
        className="chip"
        title="Show what the practice's standard wording would change here — nothing is applied until you accept it"
        onClick={run}
        disabled={pending !== null}
      >
        ✨ Standardize
      </button>
      {/* THE ARE-YOU-SURE. Both buttons, side by side, with the diff open
          underneath: the question is "is this right?", and it cannot be
          answered by a button alone. Keep mine is listed second but is the
          zero-cost option — declining changes nothing at all. */}
      {pending && (
        <ApplyWithReadback
          before={pending.before}
          after={pending.after}
          applyLabel="Apply this wording"
          onApply={() => {
            onApply(pending.after);
            setPrior(pending);
            setPending(null);
            setShowDiff(false);
            setNote("applied — Undo puts your wording back");
            setTimeout(() => setNote(null), 6000);
          }}
          onKeep={() => {
            setPending(null);
            setShowDiff(false);
            setNote("kept your wording");
            setTimeout(() => setNote(null), 6000);
          }}
        />
      )}
      {/*
        The way back.

        This is a controlled input, so a programmatic rewrite wipes the
        browser's own undo stack — Ctrl-Z could not recover what the writer
        typed, and nothing else offered to. A clinician who pressed the button
        and disliked the result had to retype the field from memory, which is
        both a bad experience and a quiet invitation to accept wording they
        would not have chosen.

        Restoring a person's own words can never be the dangerous option, so
        this needs no confirmation and no attestation. It stays available until
        they type again, at which point their newer words take precedence.
      */}
      {canUndo && (
        <button
          type="button"
          className="chip"
          title="Put back exactly what you typed before Standardize ran"
          onClick={() => {
            onApply(prior.before);
            setPrior(null);
            setShowDiff(false);
            setNote("your wording is back");
            setTimeout(() => setNote(null), 6000);
          }}
        >
          ↩ Undo
        </button>
      )}
      {/*
        Undo answers "put it back". This answers "what did you do?" — and it is
        the one a clinician needs BEFORE deciding, because the alternative is
        accepting a rewrite of a legal record on the strength of a word count.
      */}
      {canUndo && (
        <button
          type="button"
          className="chip"
          aria-expanded={showDiff}
          onClick={() => setShowDiff((v) => !v)}
        >
          {showDiff ? "Hide changes" : "See changes"}
        </button>
      )}
      {note && (
        <span className="text-xs text-slate-600" role="status">
          {note}
        </span>
      )}
      {/*
        A caution, not a lock.

        This field was shipped with the button REMOVED, on the reasoning that
        standardizing patient-facing prose runs it the wrong way — "x-ray"
        becomes "radiograph" in the one box written for the person who had it
        taken. That reasoning still holds, and it is now stated here instead of
        enforced: taking a control away decides for the clinician, and a
        clinician who pasted clinical shorthand into this box and wants it
        expanded first has a perfectly good reason to press it.

        The bar for removing a choice is that the choice is dangerous or
        meaningless. This one is neither — it is merely usually wrong, which is
        what a sentence of warning is for. Undo covers the rest.
      */}
      {caution && (
        <span className="basis-full text-xs text-amber-700">{caution}</span>
      )}
      {showDiff && (pending ?? prior) && (
        <div className="basis-full">
          {pending && (
            <p className="mb-1 text-xs font-semibold text-slate-700">
              Proposed. Nothing has changed in your note yet.
            </p>
          )}
          <TextDiff before={(pending ?? prior)!.before} after={(pending ?? prior)!.after} />
        </div>
      )}
    </div>
  );
}

export function TextInputField({ field, value, onChange, describedBy, invalid, id, required }: InputProps<TextField, Extract<FieldValue, { kind: "text" }>>) {
  const ref = useRef<HTMLInputElement>(null);
  const insert = (phrase: string) => {
    const el = ref.current;
    const text = value?.value ?? "";
    const pos = el?.selectionStart ?? text.length;
    onChange({ kind: "text", value: text.slice(0, pos) + phrase + text.slice(pos) });
    el?.focus();
  };
  return (
    <div>
      <input
        ref={ref}
        id={id}
        type="text"
        className="field-input"
        placeholder={field.placeholderHint}
        value={value?.value ?? ""}
        {...aria(describedBy, invalid)}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
      />
      <PhraseChips phrases={field.standardPhrases ?? []} onInsert={insert} />
      {/* The fact is offered first, the absence second. See LicenceChips. */}
      {required && (
        <LicenceChips value={value?.value ?? ""} onPick={(text) => onChange({ kind: "text", value: text })} />
      )}
      {/*
        The standardizer's whole job is to move prose TOWARD the clinical
        register — "x-ray" becomes "radiograph", "tx" becomes "treatment" — so
        on a paragraph written for the person in the chair it usually runs the
        wrong way. That earns a warning, not a locked door: the writer may have
        pasted clinical shorthand in and want it expanded before rewriting, and
        Undo puts their words back either way.
      */}
      <StandardizeField
        text={value?.value ?? ""}
        onApply={(next) => onChange({ kind: "text", value: next })}
        caution={
          field.audience === "patient"
            ? "Heads up: this rewrites toward clinical wording — the opposite of what this box is for. Undo puts your words back."
            : undefined
        }
      />
    </div>
  );
}

export function TextareaField_({ field, value, onChange, describedBy, invalid, id, required }: InputProps<TextareaField, Extract<FieldValue, { kind: "text" }>>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const insert = (phrase: string) => {
    const el = ref.current;
    const text = value?.value ?? "";
    const pos = el?.selectionStart ?? text.length;
    onChange({ kind: "text", value: text.slice(0, pos) + phrase + text.slice(pos) });
    el?.focus();
  };
  return (
    // Focus is tracked on the WRAPPER, not the textarea.
    //
    // React's onFocus/onBlur are focusin/focusout, so they bubble, and this
    // element is the only one that sees focus move through the whole field —
    // textarea, chip, and everything the chip opens. Watching the textarea
    // alone was wrong in both directions. Tab from the textarea to the chip and
    // the textarea's blur was the LAST one it would ever fire: focus left the
    // button afterwards, the textarea never heard about it, and the chip stayed
    // mounted under an empty field for the rest of the session, one per field
    // visited. And a click that landed anywhere other than the textarea could
    // not be told apart from leaving the field without asking the wrapper.
    <div
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Leaving for somewhere still inside this field is not leaving.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <textarea
        ref={ref}
        id={id}
        className="field-input"
        rows={field.rows ?? 3}
        placeholder={field.placeholderHint}
        value={value?.value ?? ""}
        {...aria(describedBy, invalid)}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
      />
      {/* The microphone — or, when there is not one, the reason. It used to
          render nothing in every case except "enrolled and supported", so the
          note page contained no mic and never said the word dictation: a
          writer who wanted to talk to the app could not discover that the
          feature existed. `active` keeps the explanation in the box the cursor
          is in, so somebody who is simply typing still pays nothing for it. */}
      <DictationField
        onText={(t) => insert(t)}
        active={focused || (value?.value ?? "") !== ""}
        focused={focused}
      />
      {/* Verified blocks, in the field they go into.
          They used to sit in a card ABOVE the note behind a "insert verified
          blocks into [destination]" dropdown — which asked the writer to choose
          where before they had chosen what, and put an occasional tool in front
          of the thing they do every time. Here there is no destination to pick:
          the block lands in the box the cursor is already in. All three locks
          are unchanged — every assertion ticked, insert disabled until they are,
          and placeholders the residue rule blocks at S1 until they are replaced. */}
      {/* ONE ROW OF CHIPS, NOT FOUR.
          Each of these renders its own block-level wrapper, so a text box was
          followed by "Verified block" on one line, "Standardize" on the next,
          the standard phrases on a third and the licence chips on a fourth —
          about a hundred and fifty pixels of controls under every field, times
          eleven sections. They are all chips and they all belong to the box
          above them, so they share a line and wrap only when they run out of
          it. Each keeps its own expanded state: `w-full` on a child that has
          opened something gives the diff or the block list the whole width
          back. */}
      <div className="flex flex-wrap items-center gap-x-2 [&>*]:min-w-0">
        <BlockChips onInsert={insert} active={focused || (value?.value ?? "") !== ""} />
        <PhraseChips phrases={field.standardPhrases ?? []} onInsert={insert} />
        {/* The fact is offered first, the absence second. See LicenceChips. */}
        {required && (
          <LicenceChips value={value?.value ?? ""} onPick={(text) => onChange({ kind: "text", value: text })} />
        )}
        {/*
          The standardizer's whole job is to move prose TOWARD the clinical
          register — "x-ray" becomes "radiograph", "tx" becomes "treatment" — so
          on a paragraph written for the person in the chair it usually runs the
          wrong way. That earns a warning, not a locked door: the writer may have
          pasted clinical shorthand in and want it expanded before rewriting, and
          Undo puts their words back either way.
        */}
        <StandardizeField
          text={value?.value ?? ""}
          onApply={(next) => onChange({ kind: "text", value: next })}
          caution={
            field.audience === "patient"
              ? "Heads up: this rewrites toward clinical wording — the opposite of what this box is for. Undo puts your words back."
              : undefined
          }
        />
      </div>
    </div>
  );
}

export function MeasurementInput({ field, value, onChange, describedBy, invalid, id }: InputProps<MeasurementField, Extract<FieldValue, { kind: "measurement" }>>) {
  const unit = value?.unit ?? field.units[0];
  return (
    <div className="flex gap-1.5">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="field-input max-w-36"
        min={field.min}
        max={field.max}
        step={field.decimals ? 10 ** -field.decimals : "any"}
        value={value?.value ?? ""}
        {...aria(describedBy, invalid)}
                onChange={(e) =>
          onChange({
            kind: "measurement",
            value: e.target.value === "" ? null : Number(e.target.value),
            unit
          })
        }
      />
      <select
        className="field-input max-w-32"
        value={unit}
        aria-label={`${field.label} unit`}
        onChange={(e) => onChange({ kind: "measurement", value: value?.value ?? null, unit: e.target.value as never })}
      >
        {field.units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}
