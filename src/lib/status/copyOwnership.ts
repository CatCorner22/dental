import type { AuditFinding } from "@/lib/audit/types";
import {
  canRecordClinicalJudgement,
  type ClinicalRole
} from "@/lib/auth/clinicalRoles";
import { isDentistJudgementRule } from "@/lib/scope/authorCapabilities";

/**
 * Honest Finish co-design (associate DDS Adopt):
 * Auxiliaries must not Copy a note whose open killers coach dentist judgement
 * (clinical rationale / justify.*). Soft S2 still allows Copy for other killers
 * after ack — this gate is ownership, not severity.
 *
 * Pure: does not invent clinical facts; does not change computeGates.
 */
export function copyBlockedForDentistJudgement(args: {
  clinicalRole: ClinicalRole;
  killers: readonly AuditFinding[];
}): boolean {
  if (canRecordClinicalJudgement(args.clinicalRole)) return false;
  return args.killers.some((k) => isDentistJudgementRule(k.ruleId));
}
