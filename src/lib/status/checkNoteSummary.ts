import type { AuditFinding, AuditReport, Severity } from "@/lib/audit/types";
import { SEVERITY_ORDER } from "@/lib/audit/types";
import { isKillerFinding } from "@/lib/audit/killers";
import type { OmissionReport } from "@/lib/audit/omissions";

/**
 * Finish-gate checklist for Copy / Submit — GOV.UK check-answers style.
 *
 * Pure: does not mutate the report, does not invent clinical facts, does not
 * change computeGates. Killers stay hoistable even when they are only S2.
 *
 * See knowledge/sources/check-your-note-ux-research.md.
 */
export interface CheckNoteModuleRef {
  id: string;
  title: string;
}

export interface CheckNoteSummary {
  moduleTitles: string[];
  /** Litigation / wrong-site items — shown first, require ack when any open. */
  killers: AuditFinding[];
  /** S0/S1 that are not already in killers (required.missing, PHI, etc.). */
  openStops: AuditFinding[];
  omissionCount: number;
  requiresKillerAck: boolean;
}

function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

function bySeverityThenId(a: AuditFinding, b: AuditFinding): number {
  const bySev = severityRank(a.severity) - severityRank(b.severity);
  if (bySev !== 0) return bySev;
  return a.ruleId.localeCompare(b.ruleId);
}

export function buildCheckNoteSummary(args: {
  report: AuditReport;
  omissions: OmissionReport;
  modules: CheckNoteModuleRef[];
}): CheckNoteSummary {
  const killers = args.report.findings.filter(isKillerFinding).slice().sort(bySeverityThenId);
  const killerKeys = new Set(
    killers.map(
      (f) =>
        `${f.ruleId}|${f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : ""}|${f.matchedText ?? ""}`
    )
  );
  const openStops = args.report.findings
    .filter((f) => f.severity === "S0" || f.severity === "S1")
    .filter((f) => {
      const key = `${f.ruleId}|${f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : ""}|${f.matchedText ?? ""}`;
      return !killerKeys.has(key);
    })
    .slice()
    .sort(bySeverityThenId);

  return {
    moduleTitles: args.modules.map((m) => m.title),
    killers,
    openStops,
    omissionCount: args.omissions.licensed,
    requiresKillerAck: killers.length > 0
  };
}
