import type { AuditReport } from "@/lib/audit/types";
import { SEVERITY_LABELS } from "@/lib/audit/types";
import type { ModuleDef } from "@/lib/schema/types";
import { MODULES_BY_ID } from "@/lib/modules";
import { RULESET_VERSION } from "@/lib/version";

export const AUDIT_VERSION = `deterministic-checker ${RULESET_VERSION}`;

function ownerFor(severity: string): string {
  if (severity === "S3") return "staff";
  if (severity === "S4") return "office workflow";
  return "clinician";
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// Matches the "Audit output" format in the formal audit pass
// (skill/assets/dental-note-templates.md). Never a percentage or score.
export function composeAuditReport(
  report: AuditReport,
  activeModules: ModuleDef[],
  draft: string
): string {
  const lines: string[] = [
    "# Dental-note audit",
    "",
    `- Status: ${report.status}`,
    "- Rule profile: national + Tennessee",
    `- Modules confirmed: ${activeModules.map((m) => m.title).join("; ")}`,
    `- Audit version: ${AUDIT_VERSION}`,
    "",
    "## Issues",
    "",
    "| ID | Severity | Module | Location | Finding | Required action | Owner |",
    "|---|---|---|---|---|---|---|"
  ];

  report.findings.forEach((f, i) => {
    const moduleTitle = f.fieldRef
      ? (MODULES_BY_ID.get(f.fieldRef.moduleId)?.title ?? f.fieldRef.moduleId)
      : "note text";
    const location = f.fieldRef
      ? f.fieldRef.fieldId
      : f.matchedText
        ? `"${f.matchedText}"`
        : "—";
    const action = f.suggestion ? `Use: ${f.suggestion}` : f.message;
    lines.push(
      `| ${i + 1} | ${f.severity} ${SEVERITY_LABELS[f.severity]} | ${cell(moduleTitle)} | ${cell(
        location
      )} | ${cell(f.message)} | ${cell(action)} | ${ownerFor(f.severity)} |`
    );
  });
  if (report.findings.length === 0) {
    lines.push("| — | — | — | — | No finding from the deterministic checker. | Clinician review still required. | clinician |");
  }

  lines.push(
    "",
    "## Terms changed",
    "",
    "| Before | After | Rule | Clinician confirmation needed |",
    "|---|---|---|---|",
    "| — | — | This tool never changes clinical text. Suggestions above are applied only by a person. | — |",
    "",
    "## Draft note",
    "",
    draft,
    "",
    "## EDR-only finalization",
    "",
    "- [ ] Correct chart confirmed locally",
    "- [ ] Dates, times, identities, authority, and signatures completed locally",
    "- [ ] Linked records reconciled",
    "- [ ] Every issue resolved or given a clinician-approved disposition",
    "- [ ] Licensed clinician compared every fact with the source and signed",
    "",
    "The deterministic checker screens possible identifiers, placeholders, controlled typos, ambiguous abbreviations, vague phrases, duplicate text, selected contradictions, ADA Universal tooth values, and surfaces. It does not replace the semantic audit or clinician review."
  );
  return lines.join("\n");
}
