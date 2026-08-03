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
import { TextDiff } from "@/components/diff/TextDiff";

interface InputProps<F extends Field, V extends FieldValue> {
  field: F;
  value: V | undefined;
  onChange: (value: FieldValue) => void;
  describedBy?: string;
  invalid?: boolean;
  // id of the primary control, so the visible <label htmlFor> names it for
  // screen readers. Group-style controls use aria-label instead.
  id?: string;
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
                  ? "border-blue-700 bg-blue-700 text-white"
                  : `bg-white text-slate-700 hover:bg-blue-50 ${invalid ? "border-rose-400" : "border-slate-300"}`
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
              ? "border-blue-700 bg-blue-700 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-blue-50"
          }`}
        >
          {o.label ?? o.value}
        </button>
      ))}
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
    if (r.text !== text) {
      setPrior({ before: text, after: r.text });
      setShowDiff(false);
      onApply(r.text);
    }
    const parts: string[] = [];
    // Loudest first: something was LOST, which matters more than what changed.
    const changes = r.applied.filter((a) => a.kind !== "formatting").length;
    if (r.text !== text) {
      parts.push(changes > 0 ? `${changes} change${changes === 1 ? "" : "s"} applied` : "tidied");
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
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="chip"
        title="Rewrite this field in the practice's standard wording"
        onClick={run}
      >
        ✨ Standardize
      </button>
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
      {showDiff && prior && (
        <div className="basis-full">
          <TextDiff before={prior.before} after={prior.after} />
        </div>
      )}
    </div>
  );
}

export function TextInputField({ field, value, onChange, describedBy, invalid, id }: InputProps<TextField, Extract<FieldValue, { kind: "text" }>>) {
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

export function TextareaField_({ field, value, onChange, describedBy, invalid, id }: InputProps<TextareaField, Extract<FieldValue, { kind: "text" }>>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (phrase: string) => {
    const el = ref.current;
    const text = value?.value ?? "";
    const pos = el?.selectionStart ?? text.length;
    onChange({ kind: "text", value: text.slice(0, pos) + phrase + text.slice(pos) });
    el?.focus();
  };
  return (
    <div>
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
      <PhraseChips phrases={field.standardPhrases ?? []} onInsert={insert} />
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
