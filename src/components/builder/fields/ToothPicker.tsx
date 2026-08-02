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
  onChange
}: {
  field: ToothPickerField;
  value: Extract<FieldValue, { kind: "teeth" }> | undefined;
  onChange: (value: FieldValue) => void;
}) {
  const [dentition, setDentition] = useState<Dentition>(field.dentitions[0]);
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
    <div className="rounded border border-slate-200 bg-slate-50 p-2">
      {field.dentitions.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {field.dentitions.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDentition(d)}
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                dentition === d ? "bg-blue-700 text-white" : "bg-white text-slate-600 border border-slate-300"
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
              title={tooth.name}
              onClick={() => toggle(tooth.id)}
              className={`h-8 min-w-8 rounded border px-1 text-xs font-semibold ${
                selected.includes(tooth.id)
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-blue-50"
              }`}
            >
              {tooth.id}
            </button>
          ))}
        </div>
      ))}
      {selected.length > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          Selected: {selected.map((id) => `${id} (${TOOTH_TABLE.get(id)?.name ?? "?"})`).join("; ")}
        </p>
      )}
    </div>
  );
}
