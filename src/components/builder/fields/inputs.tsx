"use client";

import { useRef } from "react";
import type {
  Field,
  FieldValue,
  MeasurementField,
  MultiselectField,
  SelectField,
  TextField,
  TextareaField
} from "@/lib/schema/types";

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
        aria-label={`${field.label} value`}
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
