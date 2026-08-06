"use client";

import { useState } from "react";
import {
  PERMANENT_MANDIBULAR_ORDER,
  PERMANENT_MAXILLARY_ORDER,
  PRIMARY_MANDIBULAR_ORDER,
  PRIMARY_MAXILLARY_ORDER,
  TOOTH_TABLE,
  allowedSurfaces
} from "@/lib/vocab/teeth";
import { SURFACE_NAMES } from "@/lib/vocab/surfaces";

function ChartRow({ ids, selected, onPick }: { ids: string[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const tooth = TOOTH_TABLE.get(id);
        return (
          <button
            key={id}
            type="button"
            title={tooth?.name}
            aria-label={tooth ? `${id} — ${tooth.name}` : id}
            aria-pressed={selected === id}
            onClick={() => onPick(id)}
            className={`tap-sq h-9 w-9 rounded border text-sm font-medium ${
              selected === id
                ? "border-brand-blue bg-brand-blue text-white"
                : tooth?.isAnterior
                  ? "border-slate-300 bg-white hover:bg-brand-blue/10"
                  : "border-slate-300 bg-slate-100 hover:bg-brand-blue/10"
            }`}
          >
            {id}
          </button>
        );
      })}
    </div>
  );
}

export function ToothChart() {
  const [dentition, setDentition] = useState<"permanent" | "primary">("permanent");
  const [selected, setSelected] = useState<string | null>(null);
  const tooth = selected ? TOOTH_TABLE.get(selected) : undefined;
  const upper = dentition === "permanent" ? PERMANENT_MAXILLARY_ORDER : PRIMARY_MAXILLARY_ORDER;
  const lower = dentition === "permanent" ? PERMANENT_MANDIBULAR_ORDER : PRIMARY_MANDIBULAR_ORDER;

  return (
    <div className="mb-8 rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex gap-2">
        {(["permanent", "primary"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={dentition === d}
            onClick={() => {
              setDentition(d);
              setSelected(null);
            }}
            className={`rounded px-3 py-1 text-sm font-medium ${
              dentition === d ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {d === "permanent" ? "Permanent (1-32)" : "Primary (A-T)"}
          </button>
        ))}
      </div>
      <p className="mb-1 text-xs font-medium text-slate-500">
        Maxillary — patient&apos;s right is on your left
      </p>
      <ChartRow ids={upper} selected={selected} onPick={setSelected} />
      <p className="mb-1 mt-3 text-xs font-medium text-slate-500">Mandibular</p>
      <ChartRow ids={lower} selected={selected} onPick={setSelected} />
      {tooth && (
        <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
          <p className="font-semibold">
            Tooth {tooth.id}: {tooth.name}
            {tooth.fdi && <span className="ml-1 font-normal text-slate-500">(FDI {tooth.fdi})</span>}
          </p>
          <p className="text-slate-600">
            Quadrant {tooth.quadrant} · {tooth.isAnterior ? "anterior" : "posterior"} · surfaces:{" "}
            {allowedSurfaces(tooth.id)
              .map((s) => `${s} (${SURFACE_NAMES[s]})`)
              .join(", ")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supernumerary designation:{" "}
            {tooth.dentition === "permanent" ? Number(tooth.id) + 50 : `${tooth.id}S`} (ADA
            Universal system: {tooth.dentition === "permanent" ? "tooth number + 50" : "letter + S"})
          </p>
        </div>
      )}
    </div>
  );
}
