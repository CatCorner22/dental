// "Replace vague or unsafe phrases" plus the core ambiguity rules —
// mirrors skill/references/terminology-and-style.md.

export interface VaguePhrase {
  id: string;
  pattern: RegExp; // must carry the g flag (scanned with matchAll)
  display: string;
  replacement: string; // "write instead"
}

export const VAGUE_PHRASES: VaguePhrase[] = [
  {
    id: "tolerated-well",
    pattern: /\btolerated\b[^.\n]{0,40}?\bwell\b/gi,
    display: "tolerated well",
    replacement:
      "state the observed response, complications, vital-status facts, and condition at transfer"
  },
  {
    id: "hemostasis-achieved",
    pattern: /\bhemostasis\s+(?:was\s+)?achieved\b/gi,
    display: "hemostasis achieved",
    replacement: "state the method and the observed bleeding status"
  },
  {
    id: "consent-obtained",
    pattern: /\bconsent\s+(?:was\s+)?obtained\b/gi,
    display: "consent obtained",
    replacement: "state the discussion topics, questions, decision, and form status"
  },
  {
    id: "all-questions-answered",
    pattern: /\ball questions\s+(?:were\s+)?answered\b/gi,
    display: "all questions answered",
    replacement: "the clinician answered the patient's stated questions"
  },
  {
    id: "normal",
    pattern: /\bnormal\b(?!\s+saline)/gi,
    display: "normal",
    replacement: "name the structure, test, range, or finding"
  },
  {
    id: "stable",
    pattern: /\bstable\b/gi,
    display: "stable",
    replacement: "name the unchanged finding, the comparison, and the period"
  },
  {
    id: "adequate",
    pattern: /\badequate\b/gi,
    display: "adequate",
    replacement: "state the criterion that was met"
  },
  {
    id: "significant",
    pattern: /\bsignificant\b/gi,
    display: "significant",
    replacement: "state the measurement or clinical effect"
  },
  {
    id: "minimal",
    pattern: /\bminimal\b(?!\s+sedation)/gi,
    display: "minimal",
    replacement: "give a measurement or defined scale; keep formal anesthesia-depth terms"
  },
  {
    id: "moderate",
    pattern: /\bmoderate\b(?!\s+sedation)/gi,
    display: "moderate",
    replacement: "give a measurement or defined scale; keep formal anesthesia-depth terms"
  },
  {
    id: "routine",
    pattern: /\broutine\b/gi,
    display: "routine",
    replacement: "name the reason, interval, or procedure"
  },
  {
    id: "as-needed",
    pattern: /\bas needed\b/gi,
    display: "as needed",
    replacement: "state the trigger and the action"
  },
  {
    id: "appears",
    pattern: /\bappears\b/gi,
    display: "appears",
    replacement: "state the observation and the reason for uncertainty"
  },
  {
    id: "noncompliant",
    pattern: /\bnon-?compliant\b/gi,
    display: "noncompliant",
    replacement: "state the missed action or declined care and its clinical effect"
  },
  {
    id: "patient-denies",
    pattern: /\b(?:patient|pt)\s+denies\b/gi,
    display: "patient denies",
    replacement: "patient reports no, followed by the exact symptom or event"
  },
  {
    id: "poor-historian",
    pattern: /\bpoor historian\b/gi,
    display: "poor historian",
    replacement: "identify the missing fact and the source limitation"
  },
  {
    id: "unremarkable",
    pattern: /\bunremarkable\b/gi,
    display: "unremarkable",
    replacement: "name the structure and the observed finding"
  },
  {
    id: "grossly-intact",
    pattern: /\bgrossly intact\b/gi,
    display: "grossly intact",
    replacement: "name the tested function and the result"
  },
  {
    id: "no-complications",
    pattern: /\bno complications\b/gi,
    display: "no complications",
    replacement:
      "no complication was observed during the stated procedure or observation period"
  },
  {
    id: "and-or",
    pattern: /\band\/or\b/gi,
    display: "and/or",
    replacement: "state each option separately; write \"A, B, or both\" when both are possible"
  },
  {
    id: "etc",
    pattern: /\betc\.?(?=[\s,;:)]|$)/gi,
    display: "etc.",
    replacement: "list each item; do not use etc."
  },
  {
    id: "respectively",
    pattern: /\brespectively\b/gi,
    display: "respectively",
    replacement: "repeat the tooth, site, drug, device, or actor instead of pairing lists"
  }
];

// Copy-forward and stale-text signals from the template-residue checks.
// These are review findings: the wording may be true, but a clinician must
// confirm it was written for this visit.
export const STALE_PHRASES: VaguePhrase[] = [
  {
    id: "same-as-above",
    pattern: /\bsame as above\b/gi,
    display: "same as above",
    replacement: "restate the fact for this entry"
  },
  {
    id: "see-previous-note",
    pattern: /\bsee previous note\b/gi,
    display: "see previous note",
    replacement: "state the fact in this entry; link records only in the EDR"
  },
  {
    id: "unchanged",
    pattern: /\bunchanged\b/gi,
    display: "unchanged",
    replacement: "name the unchanged finding, the comparison, and the period"
  },
  {
    id: "today",
    pattern: /\btoday\b/gi,
    display: "today",
    replacement: "use a relative interval or leave the exact date for the EDR"
  },
  {
    id: "last-visit",
    pattern: /\blast visit\b/gi,
    display: "last visit",
    replacement: "state the interval and what happened, or mark it unresolved"
  },
  {
    id: "previously",
    pattern: /\bpreviously\b/gi,
    display: "previously",
    replacement: "state when and what happened, or mark it unresolved"
  }
];
