"use client";

import type { FieldValue, Surface, SurfacePickerField, ToothId } from "@/lib/schema/types";
import { allowedSurfaces, getTooth } from "@/lib/vocab/teeth";
import { ALL_SURFACES, SURFACE_NAMES } from "@/lib/vocab/surfaces";

// Poka-yoke in the control: invalid surfaces are disabled per tooth, so the
// anatomy stop rule rarely even fires.
export function SurfacePicker({
  field,
  linkedTeeth,
  value,
  onChange
}: {
  field: SurfacePickerField;
  linkedTeeth: ToothId[];
  value: Extract<FieldValue, { kind: "surfaces" }> | undefined;
  onChange: (value: FieldValue) => void;
}) {
  const byTooth = value?.byTooth ?? {};

  if (linkedTeeth.length === 0) {
    return <p className="text-xs text-slate-500">Pick the tooth first; surfaces attach to each tooth.</p>;
  }

  const toggle = (tooth: ToothId, surface: Surface) => {
    const current = byTooth[tooth] ?? [];
    const next = current.includes(surface)
      ? current.filter((s) => s !== surface)
      : [...current, surface];
    onChange({ kind: "surfaces", byTooth: { ...byTooth, [tooth]: next } });
  };

  return (
    <div className="space-y-1.5">
      {linkedTeeth.map((toothId) => {
        const tooth = getTooth(toothId);
        const allowed = allowedSurfaces(toothId);
        const chosen = byTooth[toothId] ?? [];
        return (
          <div key={toothId} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-slate-700" title={tooth?.name}>
              Tooth {toothId}
            </span>
            <div className="flex gap-1">
              {ALL_SURFACES.map((s) => {
                const isAllowed = allowed.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!isAllowed}
                    title={
                      isAllowed
                        ? SURFACE_NAMES[s]
                        : `${SURFACE_NAMES[s]} does not apply to this ${tooth?.isAnterior ? "anterior" : "posterior"} tooth`
                    }
                    onClick={() => toggle(toothId, s)}
                    className={`h-7 w-7 rounded border text-xs font-semibold ${
                      chosen.includes(s)
                        ? "border-blue-700 bg-blue-700 text-white"
                        : isAllowed
                          ? "border-slate-300 bg-white text-slate-700 hover:bg-blue-50"
                          : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
