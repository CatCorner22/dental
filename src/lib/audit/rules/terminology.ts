import type { AuditFinding } from "../types";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { VAGUE_PHRASES } from "@/lib/vocab/vague-phrases";

export function runAbbreviationRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const abbr of BANNED_ABBREVIATIONS) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(abbr.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: `abbrev.${abbr.id}`,
        category: "abbreviation",
        severity: abbr.severityClass === "style" ? "S3" : "S2",
        message: `Replace the shorthand "${matched}".`,
        matchedText: matched,
        suggestion: abbr.replacement,
        occurrences: count
      });
    }
  }
  return findings;
}

export function runVaguePhraseRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const phrase of VAGUE_PHRASES) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(phrase.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: `vague.${phrase.id}`,
        category: "vague-phrase",
        severity: "S2",
        message: `"${matched}" is vague or unsafe wording. A clinician supplies the specific fact.`,
        matchedText: matched,
        suggestion: phrase.replacement,
        occurrences: count
      });
    }
  }
  return findings;
}
