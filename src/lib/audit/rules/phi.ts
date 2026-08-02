import type { AuditFinding } from "../types";

// Heuristic prohibited-data screen. It helps; it cannot certify
// de-identification. Drafts stay de-identified by construction (placeholders),
// and identifiers are completed only in the EDR.

interface PhiPattern {
  id: string;
  pattern: RegExp;
  severity: "S0" | "S2";
  message: string;
}

const PHI_PATTERNS: PhiPattern[] = [
  {
    id: "phi.ssn",
    pattern: /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/g,
    severity: "S0",
    message: "This looks like a Social Security number. Remove it. Identifiers belong only in the EDR."
  },
  {
    id: "phi.phone",
    pattern: /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g,
    severity: "S0",
    message: "This looks like a phone number. Remove it. Contact details belong only in the EDR."
  },
  {
    id: "phi.date",
    pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval (for example, three days ago) and enter exact dates only in the EDR."
  },
  {
    // ISO 8601, e.g. 2026-08-02. Anchored to a plausible year so ordinary
    // hyphenated measurements do not match.
    id: "phi.date-iso",
    pattern: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    id: "phi.date-name",
    pattern:
      /\b(?:january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    // "May" is also a modal verb, so this one is case-sensitive and must be
    // followed by a day number that is not a duration ("May 14" vs "may 3 days").
    id: "phi.date-may",
    pattern: /\bMay\s+\d{1,2}(?:st|nd|rd|th)?\b(?!\s*(?:days?|weeks?|months?|years?|hours?|minutes?|mm|cm|ml)\b)/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval and enter exact dates only in the EDR."
  },
  {
    id: "phi.email",
    // Quantifiers are bounded (RFC-plausible maximums) so a long run of word
    // characters with no "@" fails fast instead of backtracking quadratically.
    pattern: /\b[\w.+-]{1,64}@[\w-]{1,255}\.[\w.]{1,24}\b/g,
    severity: "S0",
    message: "This looks like an email address. Remove it. Contact details belong only in the EDR."
  },
  {
    // The trailing token must look like an identifier (contains a digit), so
    // ordinary prose such as "the patient's account of the injury" is not a
    // stop. "account"/"acct" additionally require an explicit number cue.
    id: "phi.mrn",
    pattern:
      /\b(?:mrn|medical record|chart\s*(?:no\.?|number|#)|record\s*(?:no\.?|number|#)|(?:account|acct)\s*(?:no\.?|number|#))\s*[:#]?\s*(?=[\w-]*\d)[\w-]+/gi,
    severity: "S0",
    message: "This looks like a record or account number. Remove it. Record links belong only in the EDR."
  },
  {
    id: "phi.name",
    pattern: /\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+/g,
    severity: "S0",
    message:
      "This looks like a person's name. Use a role instead (for example, the treating dentist, the referring provider)."
  },
  {
    id: "phi.name-label",
    pattern: /\b(?:patient|guardian|parent)\s+name\s*[:=]/gi,
    severity: "S0",
    message: "Do not enter names. Identity belongs only in the EDR."
  },
  {
    // Exactly nine digits is the unpunctuated Social Security format; no
    // clinical measurement uses it, so it stops rather than asks.
    id: "phi.ssn-bare",
    pattern: /\b\d{9}\b/g,
    severity: "S0",
    message:
      "This looks like an unpunctuated Social Security number. Remove it. Identifiers belong only in the EDR."
  },
  {
    id: "phi.long-number",
    pattern: /\b\d{10,}\b/g,
    severity: "S2",
    message:
      "This long number could be an identifier. A clinician confirms it is a clinical value, not an identifier."
  }
];

export function runPhiRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const p of PHI_PATTERNS) {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(p.pattern)) {
      seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
    }
    for (const [matched, count] of seen) {
      findings.push({
        ruleId: p.id,
        category: "phi",
        severity: p.severity,
        message: p.message,
        matchedText: matched,
        occurrences: count
      });
    }
  }
  return findings;
}
