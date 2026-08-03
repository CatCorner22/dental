import type { AuditFinding } from "../types";
import { GIVEN_NAMES } from "@/lib/vocab/given-names";

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
    // Numeric M/D/Y or D/M/Y with real month (1-12) and day (1-31) parts, so
    // a tooth sequence like "14-15-16" (month 14 is impossible) does not read
    // as a date and hard-block a legitimate note. Two-part forms ("3/4 crown",
    // "1/3 apical") are intentionally NOT matched.
    id: "phi.date",
    pattern:
      /\b(?:(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2]))[/-]\d{2,4}\b/g,
    severity: "S0",
    message:
      "This looks like an exact date. Use a relative interval (for example, three days ago) and enter exact dates only in the EDR."
  },
  {
    // ISO 8601, e.g. 2026-08-02, and the date part of a timestamp like
    // 2026-08-02T14:30. The trailing lookahead allows a following "T" or time
    // separator (a plain \b fails between "2" and "T", letting EDR timestamps
    // slip through) while still rejecting a run of extra digits.
    id: "phi.date-iso",
    pattern: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\d-])/g,
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

// ---------------------------------------------------------------------------
// Bare names — the gap the honorific rule left open
// ---------------------------------------------------------------------------
//
// phi.name catches "Dr. Smith" because the honorific announces the name.
// "John Smith presented for a recall" announced nothing, and passed the whole
// screen clean — the largest hole in a tool whose premise is that no patient
// identity ever enters it.
//
// The only deterministic signal available without an honorific is that "John"
// is overwhelmingly a person's name. So: a capitalized pair whose FIRST word
// is a common given name is flagged for review. A capitalized pair alone is
// not — clinical prose is full of them ("Angle Class", "Epworth Sleepiness",
// "Fort Sanders") and a screen that flags those gets muted, which costs more
// than it gains.
//
// S2 REVIEW, not S0 STOP, on purpose. The definite formats (SSN, phone,
// email, dates) earn a hard stop because they are almost never anything else.
// A name heuristic is a heuristic: "Grace Miller" is a patient, and "Bradley
// County" is where the health department is. The institution lookahead below
// removes the worst of that class, and what remains surfaces for a human
// instead of blocking the line on a guess.

// Second-word vocabulary that marks the pair as a PLACE or ORGANIZATION, not a
// person: "Christian Dental Clinic", "Bradley County", "Holly Springs". A
// Korean-style surname such as "Park" is deliberately not protected from this
// list — a screen, not a certification, and the header of this file says so.
const INSTITUTION_WORDS = new Set([
  "county", "dental", "dentistry", "clinic", "hospital", "health", "medical",
  "university", "college", "center", "centre", "pharmacy", "laboratory",
  "lab", "imaging", "radiology", "orthodontics", "periodontics",
  "endodontics", "oral", "family", "associates", "group", "practice",
  "office", "care", "springs", "street", "avenue", "road", "drive", "lane",
  "boulevard", "pike", "highway",
  // Dental supply houses whose names read exactly like a person's. "Henry
  // Schein" on a materials line is the single likeliest false positive in a
  // real note, and a flag on the supplier teaches staff to dismiss the flag.
  "schein", "patterson", "benco", "darby", "ultradent", "dentsply"
]);

// "John Smith", "Karen McDonald", "Mary O'Brien", "Robert Smith-Jones",
// "John Q. Smith".
//
// The surname is a LOOKAHEAD, and that is the whole trick. Matching it
// normally consumed both words, so on "Patient John Smith" the regex matched
// "Patient John", the dictionary rejected it, and `matchAll` resumed AFTER
// "John" — the real name was never examined. "Patient/Pt <Name>" is the
// commonest way a name enters a clinical note, so the rule missed the case it
// exists for while passing its own tests, which never put a capitalized word
// in front of the name. Consuming only the given name lets the scan re-enter
// on the next word and catch it.
//
// The whitespace is captured rather than assumed so `matchedText` is the
// EXACT source text: the masking pass replaces by literal substring, and a
// normalized "John Smith" would silently fail to replace a "John  Smith" that
// really had two spaces, leaving the identifier in the note.
const NAME_PAIR =
  /\b([A-Z][a-z]{1,20})(\s+(?:[A-Z]\.\s+)?)(?=((?:Mc|Mac|O['’]|D['’])?[A-Z][a-z]{1,24}(?:-[A-Z][a-z]{1,24})?)\b)/g;

// The same pair in ALL CAPS — how an EHR chart header usually pastes in.
const NAME_PAIR_CAPS = /\b([A-Z]{2,20})(\s+(?:[A-Z]\.\s+)?)(?=([A-Z][A-Z'’-]{1,24})\b)/g;

// Chart-header order: "Smith, John" and "SMITH, JOHN". High signal — prose
// rarely puts a capitalized word, a comma, and a given name in a row for any
// other reason. `\s*` because a CSV or EHR paste often has no space.
const NAME_COMMA =
  /\b((?:Mc|Mac|O['’]|D['’])?[A-Z][a-zA-Z]{1,24}),(\s*)([A-Z][a-zA-Z]{1,20})\b/g;

const BARE_NAME_MESSAGE =
  "This may be a person's name. The tool cannot be sure — if it is a person, use a role instead (the patient, the referring provider); if it is a product, place, or term of art, a clinician confirms that.";

function pushCounted(
  findings: AuditFinding[],
  seen: Map<string, number>,
  ruleId: string,
  message: string
): void {
  for (const [matched, count] of seen) {
    findings.push({
      ruleId,
      category: "phi",
      severity: "S2",
      message,
      matchedText: matched,
      occurrences: count
    });
  }
}

function runBareNameRules(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Title case and ALL CAPS share the filter; only the regex differs. The
  // surname arrives in the lookahead group (index 3), so the matched text is
  // rebuilt from the given name + the real whitespace + the surname.
  const pairSeen = new Map<string, number>();
  for (const re of [NAME_PAIR, NAME_PAIR_CAPS]) {
    for (const m of text.matchAll(re)) {
      const [given, gap, surname] = [m[1], m[2], m[3]];
      if (!GIVEN_NAMES.has(given.toLowerCase())) continue;
      if (INSTITUTION_WORDS.has(surname.toLowerCase())) continue;
      const matched = given + gap + surname;
      pairSeen.set(matched, (pairSeen.get(matched) ?? 0) + 1);
    }
  }
  pushCounted(findings, pairSeen, "phi.name-bare", BARE_NAME_MESSAGE);

  const commaSeen = new Map<string, number>();
  for (const m of text.matchAll(NAME_COMMA)) {
    const [surname, gap, given] = [m[1], m[2], m[3]];
    if (!GIVEN_NAMES.has(given.toLowerCase())) continue;
    if (INSTITUTION_WORDS.has(surname.toLowerCase())) continue;
    const matched = `${surname},${gap}${given}`;
    commaSeen.set(matched, (commaSeen.get(matched) ?? 0) + 1);
  }
  pushCounted(
    findings,
    commaSeen,
    "phi.name-comma",
    "This reads like a chart-header name (surname, given name). " + BARE_NAME_MESSAGE
  );

  return findings;
}

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
  findings.push(...runBareNameRules(text));
  return findings;
}
