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
  onChange,
  describedBy,
  invalid
}: {
  field: SurfacePickerField;
  linkedTeeth: ToothId[];
  value: Extract<FieldValue, { kind: "surfaces" }> | undefined;
  onChange: (value: FieldValue) => void;
  // See ToothPicker: these two renderers were the only ones not receiving the
  // description and validity wiring every other field gets.
  describedBy?: string;
  invalid?: boolean;
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
    <div
      className="space-y-1.5"
      role="group"
      aria-label={field.label}
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
    >
      {linkedTeeth.map((toothId) => {
        const tooth = getTooth(toothId);
        const allowed = allowedSurfaces(toothId);
        const chosen = byTooth[toothId] ?? [];
        return (
          // Wraps rather than squeezing: seven surface buttons plus the label
          // do not fit a phone on one line, and compressed-out-of-square
          // buttons are exactly where a wrong surface gets recorded.
          <div key={toothId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="w-20 shrink-0 text-xs font-semibold text-slate-700" title={tooth?.name}>
              Tooth {toothId}
            </span>
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label={`Surfaces for tooth ${toothId}`}
            >
              {ALL_SURFACES.map((s) => {
                const isAllowed = allowed.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!isAllowed}
                    aria-pressed={chosen.includes(s)}
                    aria-label={`${SURFACE_NAMES[s]} surface of tooth ${toothId}`}
                    title={
                      isAllowed
                        ? SURFACE_NAMES[s]
                        : `${SURFACE_NAMES[s]} does not apply to this ${tooth?.isAnterior ? "anterior" : "posterior"} tooth`
                    }
                    onClick={() => toggle(toothId, s)}
                    className={`tap-sq h-7 w-7 rounded border text-xs font-semibold ${
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
