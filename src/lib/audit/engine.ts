import type {
  AuditContext,
  AuditFinding,
  AuditGates,
  AuditReport,
  OverallStatus,
  Severity
} from "./types";
import { SEVERITY_ORDER } from "./types";
import type { NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";
import { runPhiRule } from "./rules/phi";
import { runResidueRule } from "./rules/residue";
import { runAbbreviationRule, runVaguePhraseRule } from "./rules/terminology";
import { runAnatomyStateRule, runAnatomyTextRule } from "./rules/anatomy";
import { newSpellingBudget, runSpellingRule } from "./rules/spelling";
import { runRequiredRule } from "./rules/required";
import { runMeasurementRule } from "./rules/measurement";

// Pure and isomorphic. The client runs the full audit live; the email route
// re-runs the text audit server-side so a tampered client cannot bypass it.

export function runTextAudit(text: string): AuditFinding[] {
  return [
    ...runPhiRule(text),
    ...runResidueRule(text),
    ...runAbbreviationRule(text),
    ...runVaguePhraseRule(text),
    ...runAnatomyTextRule(text)
  ];
}

export function runAudit(ctx: AuditContext): AuditReport {
  const findings: AuditFinding[] = [
    ...runRequiredRule(ctx.note, ctx.modules),
    ...runAnatomyStateRule(ctx.note, ctx.modules),
    ...runMeasurementRule(ctx.note, ctx.modules),
    ...runTextAudit(ctx.composedText),
    ...runFieldSpelling(ctx.note, ctx.modules)
  ];
  return buildReport(findings);
}

function runFieldSpelling(note: NoteState, modules: AuditContext["modules"]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  // ONE budget across every field, so total close-match work per audit run is
  // bounded no matter how many text fields the note spreads its words across.
  const budget = newSpellingBudget();
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (field.type !== "text" && field.type !== "textarea") continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value || value.kind !== "text" || !value.value.trim()) continue;
        findings.push(
          ...runSpellingRule(value.value, { moduleId: mod.id, fieldId: field.id }, budget)
        );
      }
    }
  }
  return findings;
}

export function buildReport(findings: AuditFinding[]): AuditReport {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  const counts: Record<Severity, number> = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };
  for (const f of sorted) counts[f.severity]++;
  const phiStops = sorted.filter((f) => f.category === "phi" && f.severity === "S0");

  let status: OverallStatus;
  if (counts.S0 > 0) status = "BLOCKED";
  else if (counts.S1 > 0) status = "NEEDS CLINICIAN ACTION";
  else if (counts.S2 > 0) status = "READY FOR CLINICIAN REVIEW";
  else status = "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

  return { findings: sorted, counts, status, phiStops };
}

// phiOverridden: the user completed the explicit override dialog and attested
// that every flagged item was reviewed and none is an identifier.
export function computeGates(report: AuditReport, phiOverridden: boolean): AuditGates {
  const phiBlocked = report.phiStops.length > 0 && !phiOverridden;
  const nonPhiStops = report.counts.S0 - report.phiStops.length;
  // Any unresolved S0 stops the line: a wrong-site or invalid-tooth note must
  // not leave the tool by copy/download either, matching the finding's own
  // "correct the site before this entry leaves the tool." A PHI S0 is the one
  // stop a person can waive, via the attested override.
  const blocked = phiBlocked || nonPhiStops > 0;
  return {
    exportAllowed: !blocked,
    emailAllowed: !blocked && report.counts.S1 === 0
  };
}
