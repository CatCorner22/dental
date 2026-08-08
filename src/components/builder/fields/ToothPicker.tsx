"use client";

import { useState } from "react";
import type { Dentition, FieldValue, ToothPickerField } from "@/lib/schema/types";
import { TOOTH_TABLE, teethForDentition } from "@/lib/vocab/teeth";

const DENTITION_LABELS: Record<Dentition, string> = {
  permanent: "Permanent",
  primary: "Primary",
  "supernumerary-permanent": "Supernumerary (51-82)",
  "supernumerary-primary": "Supernumerary (AS-TS)"
};

export function ToothPicker({
  field,
  value,
  onChange,
  describedBy,
  invalid
}: {
  field: ToothPickerField;
  value: Extract<FieldValue, { kind: "teeth" }> | undefined;
  onChange: (value: FieldValue) => void;
  // Every other field renderer receives these; the two pickers were the only
  // ones that did not, so the field's help text and its audit findings were
  // never announced here — on the two controls that decide WHICH TOOTH goes
  // into a legal record. The wrong-site stop lands on exactly these fields.
  describedBy?: string;
  invalid?: boolean;
}) {
  // Open on the dentition of the stored selection, not blindly on the first
  // tab — a saved primary tooth (e.g. "K") reopened on the Permanent tab is
  // highlighted nowhere and cannot be seen or deselected until the user
  // discovers the other tab. (Remounts — draft reload, conflict reload — run
  // this initializer again, so the tab always finds the stored teeth.)
  const [dentition, setDentition] = useState<Dentition>(() => {
    const first = value?.teeth?.[0];
    const stored = first ? TOOTH_TABLE.get(first)?.dentition : undefined;
    return stored && field.dentitions.includes(stored) ? stored : field.dentitions[0];
  });
  const selected = value?.teeth ?? [];

  const toggle = (id: string) => {
    let next: string[];
    if (selected.includes(id)) next = selected.filter((t) => t !== id);
    else if (field.multiple) next = [...selected, id];
    else next = [id];
    onChange({ kind: "teeth", teeth: next });
  };

  const teeth = teethForDentition(dentition);
  const half = teeth.length / 2;
  const rows = [teeth.slice(0, half), teeth.slice(half)];

  return (
    <div
      className={`rounded border bg-slate-50 p-2 ${invalid ? "border-red-500" : "border-slate-200"}`}
      role="group"
      aria-label={`${field.label} — tooth picker`}
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
    >
      {field.dentitions.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {field.dentitions.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dentition === d}
              onClick={() => setDentition(d)}
              className={`tap rounded px-3 py-0.5 text-xs font-medium ${
                dentition === d ? "bg-brand-blue text-white" : "bg-white text-slate-600 border border-slate-300"
              }`}
            >
              {DENTITION_LABELS[d]}
            </button>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className={`flex flex-wrap gap-1 ${i === 1 ? "mt-1" : ""}`}>
          {row.map((tooth) => (
            <button
              key={tooth.id}
              type="button"
              // FDI shown in the tooltip as a SECONDARY translation aid for
              // staff trained on ISO 3950 — Universal remains what enters the
              // record, and the FDI-leakage audit rule stays in force.
              title={tooth.fdi ? `${tooth.name} — FDI ${tooth.fdi}` : tooth.name}
              aria-label={tooth.fdi ? `${tooth.name}, FDI ${tooth.fdi}` : tooth.name}
              aria-pressed={selected.includes(tooth.id)}
              onClick={() => toggle(tooth.id)}
              // Grows under a finger via .tap-sq. Tapping the tooth next to
              // Honest Finish / a11y: 44px floor on the default path — adjacent
              // mistap is a documentation error in the legal record.
              className={`tap-sq min-h-11 min-w-11 rounded border px-1 text-xs font-semibold ${
                selected.includes(tooth.id)
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-brand-blue/10"
              }`}
            >
              {tooth.id}
            </button>
          ))}
        </div>
      ))}
      {selected.length > 0 && (
        <p className="mt-2 text-xs text-slate-600" role="status" aria-live="polite">
          Selected: {selected.map((id) => `${id} (${TOOTH_TABLE.get(id)?.name ?? "?"})`).join("; ")}
        </p>
      )}
    </div>
  );
}
