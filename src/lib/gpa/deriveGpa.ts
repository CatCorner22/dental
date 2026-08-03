import type { AuditReport } from "@/lib/audit/types";
import type { ModuleDef, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";

// The note GPA: one number a person can feel, derived from the audit report
// everyone already trusts.
//
// TWO RULES THAT OUTRANK THE MATH:
//  1. The GPA is NEVER a gate. Filing eligibility lives in computeGates and
//     fix-or-attest, full stop. A second gate keyed on a blended score would
//     eventually disagree with the first, and the note that one gate files
//     and the other locks is a support ticket with a lawyer attached.
//  2. The GPA is FROZEN at filing, like the audit it derives from. A rule
//     change next month must not silently regrade last month's work — the
//     stamp says which ruleset produced the score.
//
// The axes and weights follow the practice's training spec:
//   Completeness 30 · Specificity 30 · Consistency 20 · Justification 20
// Each axis maps a slice of the audit's finding categories, so improving the
// GPA and clearing the audit are the same physical act — the score cannot be
// gamed except by writing a better note.

export const GPA_VERSION = "1.0.0";

export interface GpaSubscores {
  completeness: number; // 0..1
  specificity: number;
  consistency: number;
  justification: number;
}

export interface GpaResult {
  gpa: number; // 0.00..4.00
  letter: "A" | "B" | "C" | "F";
  subscores: GpaSubscores;
  gpaVersion: string;
}

const WEIGHTS: Record<keyof GpaSubscores, number> = {
  completeness: 0.3,
  specificity: 0.3,
  consistency: 0.2,
  justification: 0.2
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function countVisibleRequired(note: NoteState, modules: ModuleDef[]): number {
  let count = 0;
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!field.required) continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        // fieldKey imported for parity with the required rule's addressing;
        // the count is what matters here.
        void fieldKey(mod.id, field.id);
        count++;
      }
    }
  }
  return count;
}

export function deriveGpa(report: AuditReport, note: NoteState, modules: ModuleDef[]): GpaResult {
  const byRule = (prefix: string) =>
    report.findings.filter((f) => f.ruleId.startsWith(prefix)).length;
  const byCategory = (...cats: string[]) =>
    report.findings.filter(
      (f) => cats.includes(f.category) && !f.ruleId.startsWith("justify.")
    ).length;

  // Completeness: missing required facts against how many the note owed.
  // A one-field note and a sedation record are graded on their own size.
  const requiredTotal = countVisibleRequired(note, modules);
  const requiredMissing = byRule("required.missing") + byRule("complete.");
  const completeness = clamp01(1 - requiredMissing / Math.max(requiredTotal, 4));

  // Specificity: the wording that hides facts — placeholders, vague phrases,
  // fact-hiding shorthand, stale copy-forward text.
  const vaguenesses =
    byCategory("template-residue", "vague-phrase", "stale-text") +
    report.findings.filter((f) => f.category === "abbreviation" && f.severity === "S2").length;
  const specificity = clamp01(1 - 0.15 * vaguenesses);

  // Consistency: statements that collide — anatomy, medication safety,
  // duplicates, unprofessional characterization.
  const collisions = byCategory("anatomy", "medication-safety", "duplicate-text", "stigmatizing");
  const consistency = clamp01(1 - 0.25 * collisions);

  // Justification: the billing-narrative rules. No triggered procedure means
  // full marks — a prophy note owes no crown narrative.
  const justificationGaps = byRule("justify.");
  const justification = clamp01(1 - 0.5 * justificationGaps);

  const subscores: GpaSubscores = { completeness, specificity, consistency, justification };
  const weighted =
    subscores.completeness * WEIGHTS.completeness +
    subscores.specificity * WEIGHTS.specificity +
    subscores.consistency * WEIGHTS.consistency +
    subscores.justification * WEIGHTS.justification;
  const gpa = Math.round(weighted * 4 * 100) / 100;

  const letter = gpa >= 3.7 ? "A" : gpa >= 3.0 ? "B" : gpa >= 2.0 ? "C" : "F";
  return { gpa, letter, subscores, gpaVersion: GPA_VERSION };
}
