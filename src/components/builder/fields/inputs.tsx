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
}

export function SelectInput({ field, value, onChange }: InputProps<SelectField, Extract<FieldValue, { kind: "select" }>>) {
  const current = value?.value ?? "";
  return (
    <div>
      <select
        className="field-input"
        value={current}
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
          value={value?.otherText ?? ""}
          onChange={(e) => onChange({ kind: "select", value: "__other__", otherText: e.target.value })}
        />
      )}
    </div>
  );
}

export function MultiselectInput({ field, value, onChange }: InputProps<MultiselectField, Extract<FieldValue, { kind: "multiselect" }>>) {
  const selected = value?.values ?? [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange({ kind: "multiselect", values: next });
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {field.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
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

export function TextInputField({ field, value, onChange }: InputProps<TextField, Extract<FieldValue, { kind: "text" }>>) {
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
        type="text"
        className="field-input"
        placeholder={field.placeholderHint}
        value={value?.value ?? ""}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
      />
      <PhraseChips phrases={field.standardPhrases ?? []} onInsert={insert} />
    </div>
  );
}

export function TextareaField_({ field, value, onChange }: InputProps<TextareaField, Extract<FieldValue, { kind: "text" }>>) {
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
        className="field-input"
        rows={field.rows ?? 3}
        placeholder={field.placeholderHint}
        value={value?.value ?? ""}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
      />
      <PhraseChips phrases={field.standardPhrases ?? []} onInsert={insert} />
    </div>
  );
}

export function MeasurementInput({ field, value, onChange }: InputProps<MeasurementField, Extract<FieldValue, { kind: "measurement" }>>) {
  const unit = value?.unit ?? field.units[0];
  return (
    <div className="flex gap-1.5">
      <input
        type="number"
        className="field-input max-w-36"
        min={field.min}
        max={field.max}
        step={field.decimals ? 10 ** -field.decimals : "any"}
        value={value?.value ?? ""}
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
