import type { AuditFinding } from "../types";
import type { ModuleDef, NoteState, Surface } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";
import { allowedSurfaces, getTooth, isValidToothId } from "@/lib/vocab/teeth";

// Wrong-site risk is an S0 STOP. Mixed dentition and buccal/facial usage are
// clinician-review items, not stops.

export function runAnatomyStateRule(state: NoteState, modules: ModuleDef[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, state)) continue;
        const value = state.values[fieldKey(mod.id, field.id)];
        if (!value) continue;
        const fieldRef = { moduleId: mod.id, fieldId: field.id };

        if (value.kind === "teeth") {
          const dentitions = new Set<string>();
          for (const id of value.teeth) {
            const tooth = getTooth(id);
            if (!tooth) {
              findings.push({
                ruleId: "anatomy.invalid-tooth",
                category: "anatomy",
                severity: "S0",
                message: `"${id}" is not a valid ADA Universal tooth designation.`,
                matchedText: id,
                fieldRef
              });
              continue;
            }
            dentitions.add(tooth.dentition.replace("supernumerary-", ""));
          }
          if (dentitions.size > 1) {
            findings.push({
              ruleId: "anatomy.mixed-dentition",
              category: "anatomy",
              severity: "S2",
              message:
                "Primary and permanent designations appear in one field. This is real in mixed dentition; a clinician confirms it is intended.",
              fieldRef
            });
          }
        }

        if (value.kind === "surfaces") {
          // Wrong-site guard: surfaces must belong to a tooth the linked tooth
          // field actually lists. Changing or clearing the tooth after picking
          // surfaces would otherwise leave the note asserting work on a tooth
          // it never names.
          if (field.type === "surfacePicker") {
            const linked = state.values[fieldKey(mod.id, field.linkedToothFieldId)];
            const linkedTeeth = linked?.kind === "teeth" ? linked.teeth : [];
            const toothLabel =
              section.fields.find((f) => f.id === field.linkedToothFieldId)?.label ?? "the tooth field";
            for (const [toothId, surfaces] of Object.entries(value.byTooth)) {
              if ((surfaces as Surface[]).length === 0) continue;
              if (linkedTeeth.includes(toothId)) continue;
              findings.push({
                ruleId: "anatomy.surface-orphan",
                category: "anatomy",
                severity: "S0",
                message: `Surfaces are recorded for tooth ${toothId}, but "${toothLabel}" does not list that tooth. Correct the site before this entry leaves the tool.`,
                matchedText: toothId,
                fieldRef
              });
            }
          }

          for (const [toothId, surfaces] of Object.entries(value.byTooth)) {
            const tooth = getTooth(toothId);
            if (!tooth) {
              findings.push({
                ruleId: "anatomy.invalid-tooth",
                category: "anatomy",
                severity: "S0",
                message: `"${toothId}" is not a valid ADA Universal tooth designation.`,
                matchedText: toothId,
                fieldRef
              });
              continue;
            }
            const allowed = allowedSurfaces(toothId);
            for (const s of surfaces as Surface[]) {
              if (allowed.includes(s)) continue;
              const hardStop =
                (s === "O" && tooth.isAnterior) || (s === "I" && !tooth.isAnterior);
              findings.push({
                ruleId: hardStop ? "anatomy.surface-stop" : "anatomy.surface-review",
                category: "anatomy",
                severity: hardStop ? "S0" : "S2",
                message: hardStop
                  ? `Surface ${s} is not valid on ${tooth.name} (tooth ${toothId}). Anterior teeth take I; posterior teeth take O.`
                  : `Surface ${s} on ${tooth.name} (tooth ${toothId}) mixes buccal and facial usage. Use the exact surface the clinical or claim context requires.`,
                matchedText: `${toothId}:${s}`,
                fieldRef
              });
            }
          }
        }
      }
    }
  }
  return findings;
}

// Free-text cross-check: catches impossible Universal numbers and probable
// FDI leakage ("tooth 36") in narrative text.
export function runAnatomyTextRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seen = new Map<string, number>();
  for (const m of text.matchAll(/\b(?:tooth|teeth)\s*#?\s*(\d{1,3})\b/gi)) {
    const num = m[1];
    if (isValidToothId(num)) continue;
    seen.set(num, (seen.get(num) ?? 0) + 1);
  }
  for (const [num, count] of seen) {
    const n = Number(num);
    const fdi = n >= 11 && n <= 48;
    findings.push({
      ruleId: "anatomy.text-tooth",
      category: "anatomy",
      severity: "S0",
      message: fdi
        ? `"tooth ${num}" is not a valid ADA Universal designation. It may be FDI notation; this office uses ADA Universal (1-32, A-T).`
        : `"tooth ${num}" is not a valid ADA Universal designation.`,
      matchedText: `tooth ${num}`,
      occurrences: count
    });
  }
  return findings;
}
