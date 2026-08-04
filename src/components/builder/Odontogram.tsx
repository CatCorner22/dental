"use client";

import { useMemo } from "react";
import type { Surface, ToothId } from "@/lib/schema/types";
import type { ChartMark } from "@/lib/extract/chart";
import type { ProcedureCategory, Quadrant } from "@/lib/extract/facts";
import { PERMANENT_MANDIBULAR_ORDER, PERMANENT_MAXILLARY_ORDER, getTooth } from "@/lib/vocab/teeth";

// THE READBACK. See src/lib/extract/chart.ts for why this exists; the short
// version is that it is the note said back in a different form, so that a
// transposed tooth number stops being an invisible string difference and
// becomes a mark in the wrong quadrant.
//
// COLOUR RULES, which are not negotiable:
//
//   Severity colour is NOT USED HERE. Red, orange, amber and green are the
//   audit vocabulary and they mean STOP / REQUIRED / REVIEW / clear. A chart
//   that paints an ordinary composite in amber teaches the eye that amber is
//   decoration, and the next time amber means "review this now" it gets
//   skipped. Procedure categories therefore take brand chrome colours, which
//   carry no severity anywhere else in the app.
//
//   COLOUR IS NEVER THE ONLY SIGNAL. Every mark also has a shape (filled,
//   outlined, hatched), and every tooth has its number under it and a text
//   summary in the list beside the chart. The chart is an accelerator for
//   people who can use it, never the only way to learn something.

const CATEGORY_FILL: Record<ProcedureCategory, string> = {
  surgical: "#1E3A5F",
  endodontic: "#F2CE4B",
  prosthodontic: "#7C5BA6",
  restorative: "#2B6CB8",
  periodontal: "#5FB3A8",
  preventive: "#9DC3E6",
  diagnostic: "#CBD5E1"
};

const CATEGORY_LABEL: Record<ProcedureCategory, string> = {
  surgical: "Surgical",
  endodontic: "Endodontic",
  prosthodontic: "Prosthodontic",
  restorative: "Restorative",
  periodontal: "Periodontal",
  preventive: "Preventive",
  diagnostic: "Diagnostic"
};

const TOOTH_W = 26;
const TOOTH_H = 30;
const GAP = 2;

/**
 * One tooth as five zones: four flanks and a centre.
 *
 * The classic charting shape. Mesial and distal are drawn on the sides that
 * face the way they actually face — mesial is toward the midline — so a chart
 * of the upper right and a chart of the upper left are mirror images, as they
 * are on paper. Getting this wrong would make the readback lie in exactly the
 * dimension it exists to check.
 */
function ToothGlyph({
  toothId,
  mark,
  x,
  y,
  onSelect
}: {
  toothId: ToothId;
  mark?: ChartMark;
  x: number;
  y: number;
  onSelect?: (id: ToothId) => void;
}) {
  const tooth = getTooth(toothId);
  const w = TOOTH_W;
  const h = TOOTH_H;
  const inset = 8;

  const fill = mark?.category ? CATEGORY_FILL[mark.category] : "#64748B";
  const isAffirmed = mark?.status === "affirmed";
  const isNegated = mark?.status === "negated";
  const isHinted = mark?.status === "hinted";

  // Mesial faces the midline. Universal 1-8 and 25-32 are the patient's RIGHT,
  // which we draw on the viewer's left, so their mesial is on the viewer's
  // right — and vice versa.
  const mesialOnLeft = tooth?.side === "left";
  const leftSurface: Surface = mesialOnLeft ? "M" : "D";
  const rightSurface: Surface = mesialOnLeft ? "D" : "M";
  const centre: Surface = tooth?.isAnterior ? "I" : "O";
  const outer: Surface = tooth?.isAnterior ? "F" : "B";

  const has = (s: Surface) => isAffirmed && mark?.surfaces.includes(s);
  // A whole-tooth procedure (an extraction, a crown) names no surface, so the
  // whole glyph carries it rather than nothing at all.
  const wholeTooth = isAffirmed && (mark?.surfaces.length ?? 0) === 0;

  const zone = (points: string, active: boolean, key: string) => (
    <polygon
      key={key}
      points={points}
      fill={active || wholeTooth ? fill : "#FFFFFF"}
      stroke="#94A3B8"
      strokeWidth={0.75}
    />
  );

  const summary = mark
    ? `Tooth ${toothId}${mark.procedure ? `, ${mark.procedure}` : ""}${
        mark.surfaces.length ? `, surfaces ${mark.surfaces.join("")}` : ""
      }${isNegated ? " — recorded as not present" : ""}${mark.hint ? ` — ${mark.hint}` : ""}`
    : `Tooth ${toothId}, not mentioned in this note`;

  return (
    <g
      transform={`translate(${x} ${y})`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(toothId) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(toothId);
              }
            }
          : undefined
      }
      className={onSelect ? "cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-700" : undefined}
      opacity={isHinted ? 0.45 : 1}
    >
      <title>{summary}</title>
      {zone(`0,0 ${w},0 ${w - inset},${inset} ${inset},${inset}`, has(outer), "outer")}
      {zone(`0,0 ${inset},${inset} ${inset},${h - inset} 0,${h}`, has(leftSurface), "left")}
      {zone(`${w},0 ${w},${h} ${w - inset},${h - inset} ${w - inset},${inset}`, has(rightSurface), "right")}
      {zone(`0,${h} ${inset},${h - inset} ${w - inset},${h - inset} ${w},${h}`, has("L"), "lingual")}
      {zone(`${inset},${inset} ${w - inset},${inset} ${w - inset},${h - inset} ${inset},${h - inset}`, has(centre), "centre")}

      {/* Explicitly cleared. A dashed ring says "I looked and it was fine",
          which a blank tooth cannot distinguish from "I never looked". */}
      {isNegated && (
        <rect
          x={-1.5}
          y={-1.5}
          width={w + 3}
          height={h + 3}
          fill="none"
          stroke="#475569"
          strokeWidth={1.25}
          strokeDasharray="3 2"
        />
      )}

      {/* A surface the note named that this tooth cannot have. Marked, never
          silently dropped — the audit engine decides what it means. */}
      {mark && mark.impossibleSurfaces.length > 0 && (
        <circle cx={w - 3} cy={3} r={3} fill="#DC2626" stroke="#FFFFFF" strokeWidth={1} />
      )}
    </g>
  );
}

function Arch({
  order,
  marks,
  y,
  onSelect
}: {
  order: ToothId[];
  marks: Map<ToothId, ChartMark>;
  y: number;
  onSelect?: (id: ToothId) => void;
}) {
  return (
    <>
      {order.map((id, i) => (
        <ToothGlyph
          key={id}
          toothId={id}
          mark={marks.get(id)}
          x={i * (TOOTH_W + GAP)}
          y={y}
          onSelect={onSelect}
        />
      ))}
      {order.map((id, i) => (
        <text
          key={`label-${id}`}
          x={i * (TOOTH_W + GAP) + TOOTH_W / 2}
          y={y > 40 ? y + TOOTH_H + 11 : y - 4}
          textAnchor="middle"
          className="fill-slate-600"
          style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}
        >
          {id}
        </text>
      ))}
    </>
  );
}

const QUADRANT_LABEL: Record<Quadrant, string> = {
  UR: "upper right",
  UL: "upper left",
  LL: "lower left",
  LR: "lower right"
};

/**
 * A quadrant the note treated without naming a tooth.
 *
 * Drawn as a BAND along the arch rather than as filled teeth, and the
 * difference is a claim about the note, not a style choice: "SRP upper right"
 * says work happened in a quadrant and does not say which of eight teeth were
 * instrumented. Filling them in would put a statement on the chart that the
 * note never made.
 */
function RegionBand({ quadrant, y }: { quadrant: Quadrant; y: number }) {
  const isUpper = quadrant === "UR" || quadrant === "UL";
  // Viewer's left is the patient's right.
  const onViewerLeft = quadrant === "UR" || quadrant === "LR";
  const halfWidth = 8 * TOOTH_W + 7 * GAP;
  const x = onViewerLeft ? 0 : halfWidth + GAP;
  return (
    <g>
      <rect
        x={x}
        y={isUpper ? y - 3 : y + TOOTH_H + 1}
        width={halfWidth}
        height={3}
        fill="#5FB3A8"
        rx={1.5}
      />
      <title>{`${QUADRANT_LABEL[quadrant]} quadrant treated; the note did not name individual teeth`}</title>
    </g>
  );
}

export interface OdontogramProps {
  marks: ChartMark[];
  /** Quadrants treated without a tooth being named. */
  regions?: Quadrant[];
  /** Called with a tooth id when a tooth is activated. */
  onSelectTooth?: (id: ToothId) => void;
}

export function Odontogram({ marks, regions = [], onSelectTooth }: OdontogramProps) {
  const byTooth = useMemo(() => new Map(marks.map((m) => [m.toothId, m])), [marks]);
  const width = 16 * TOOTH_W + 15 * GAP;
  const used = useMemo(() => {
    const set = new Set<ProcedureCategory>();
    for (const m of marks) if (m.category && m.status === "affirmed") set.add(m.category);
    return [...set];
  }, [marks]);

  const mentioned = marks.length;

  return (
    <div>
      <svg
        viewBox={`0 -14 ${width} ${TOOTH_H * 2 + 66}`}
        width="100%"
        role="img"
        aria-label={
          mentioned === 0
            ? "Tooth chart. This note has not named a tooth yet."
            : `Tooth chart drawn from this note. ${mentioned} ${mentioned === 1 ? "tooth" : "teeth"} named.`
        }
      >
        <Arch order={PERMANENT_MAXILLARY_ORDER} marks={byTooth} y={0} onSelect={onSelectTooth} />
        {/* The midline of the mouth. Orientation is stated in words as well,
            because "which side is the patient's right" is the single question
            a chart has to answer unambiguously and an unlabelled chart does
            not answer it. */}
        <line
          x1={0}
          y1={TOOTH_H + 22}
          x2={width}
          y2={TOOTH_H + 22}
          stroke="#CBD5E1"
          strokeWidth={1}
        />
        <text x={2} y={TOOTH_H + 19} className="fill-slate-500" style={{ fontSize: 9 }}>
          patient&apos;s right
        </text>
        <text x={width - 2} y={TOOTH_H + 19} textAnchor="end" className="fill-slate-500" style={{ fontSize: 9 }}>
          patient&apos;s left
        </text>
        <Arch order={PERMANENT_MANDIBULAR_ORDER} marks={byTooth} y={TOOTH_H + 32} onSelect={onSelectTooth} />
        {regions.map((q) => (
          <RegionBand key={q} quadrant={q} y={q === "UR" || q === "UL" ? 0 : TOOTH_H + 32} />
        ))}
      </svg>

      {regions.length > 0 && (
        <p className="mt-2 text-xs text-slate-700">
          <span
            aria-hidden
            className="mr-1.5 inline-block h-1 w-4 rounded-sm align-middle"
            style={{ backgroundColor: "#5FB3A8" }}
          />
          Treated by quadrant ({regions.map((q) => QUADRANT_LABEL[q]).join(", ")}). The note did not
          name individual teeth, so none are marked.
        </p>
      )}

      {used.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
          {used.map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-sm ring-1 ring-slate-400"
                style={{ backgroundColor: CATEGORY_FILL[c] }}
              />
              {CATEGORY_LABEL[c]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
