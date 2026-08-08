import type { AuditFinding } from "./types";

/**
 * Litigation / wrong-site items to hoist at Copy and Submit.
 *
 * This is a UI finish-discipline set, not a new severity. Completeness killers
 * stay S2 (they do not change computeGates). Anatomy wrong-site stays S0.
 * Tagging here does not alter stamped AuditFinding shape — no RULESET_VERSION
 * bump (see knowledge/sources/check-your-note-ux-research.md).
 *
 * Source: Doctors Company findings/consent/rationale gaps + MedPro sparse
 * operative chart + anatomy S0 wrong-site stops
 * (`knowledge/sources/litigation-documentation-research.md`).
 */
export const KILLER_RULE_IDS: ReadonlySet<string> = new Set([
  "complete.imaging-no-interpretation",
  "complete.anesthetic-no-amount",
  "complete.consent-no-decision",
  "complete.consent-thin-assertion",
  "complete.clinical-rationale",
  "anatomy.invalid-tooth",
  "anatomy.surface-orphan",
  "anatomy.surface-stop",
  "anatomy.text-tooth",
  "anatomy.text-surface-stop"
]);

const KILLER_SHORT_LABEL: Record<string, string> = {
  "complete.imaging-no-interpretation": "Imaging without interpretation",
  "complete.anesthetic-no-amount": "Anesthetic amount missing",
  "complete.consent-no-decision": "Consent decision missing",
  "complete.consent-thin-assertion": "Consent needs the conversation",
  "complete.clinical-rationale": "Clinical rationale missing",
  "anatomy.invalid-tooth": "Invalid tooth notation",
  "anatomy.surface-orphan": "Surface without a tooth",
  "anatomy.surface-stop": "Impossible surface for this tooth",
  "anatomy.text-tooth": "Invalid tooth in narrative",
  "anatomy.text-surface-stop": "Impossible surface in narrative"
};

export function isKillerFinding(finding: AuditFinding): boolean {
  if (KILLER_RULE_IDS.has(finding.ruleId)) return true;
  // dose.anaesthetic-max.<drug> — dynamic suffix
  if (finding.ruleId.startsWith("dose.anaesthetic-max.")) return true;
  return false;
}

/** Short finish-summary label; never invent clinical content. */
export function killerShortLabel(ruleId: string): string {
  if (KILLER_SHORT_LABEL[ruleId]) return KILLER_SHORT_LABEL[ruleId];
  if (ruleId.startsWith("dose.anaesthetic-max.")) return "Anesthetic dose needs review";
  return ruleId;
}
