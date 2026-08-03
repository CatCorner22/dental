import type { AuditFinding } from "../types";

// Anticipatory completeness: the questions a note's own content raises.
//
// Reactive rules catch what IS written. These catch what the writing PROMISES
// and then fails to deliver — the note mentions imaging, so a later reader
// will ask what it showed; it mentions anesthetic, so a later reader will ask
// how much. Each of these gaps is a documented deposition failure pattern
// (see knowledge/sources/): "RCT complete #30 with local" lost a case not for
// what it said but for everything it implied and left out.
//
// Deliberately conservative: each rule needs a strong TRIGGER (the note
// clearly performed the thing) and fires only when NO satisfying cue appears
// anywhere in the note. S2 — a clinician reviews, fixes, or attests; the
// attest path exists precisely because free text has edge cases no cue list
// anticipates.

interface CompletenessRule {
  id: string;
  trigger: RegExp;
  satisfiedBy: RegExp;
  what: string;
  how: string;
}

const RULES: CompletenessRule[] = [
  {
    id: "complete.imaging-no-interpretation",
    // Images were ACQUIRED — not merely referenced ("reviewed prior BW").
    trigger:
      /\b(?:radiographs?|bitewings?|BWX?s?|PANO|panoramic|FMX|CBCT|periapicals?|PAs?)\b[^.\n]{0,60}\b(?:taken|acquired|exposed|obtained|captured)\b|\b(?:taken|acquired|exposed|obtained|captured)\b[^.\n]{0,60}\b(?:radiographs?|bitewings?|PANO|panoramic|FMX|CBCT|periapicals?)\b/i,
    satisfiedBy:
      /\b(?:interpret|findings?|impression|reveal|shows?|showed|demonstrat|radioluc|radiopac|caries|bone\s+level|within\s+normal|no\s+(?:significant\s+)?(?:pathology|findings?|abnormalit)|WNL|unremarkable|reviewed\s+by\s+(?:the\s+)?(?:dr|dentist|doctor)|referred\s+for\s+interpretation)/i,
    what: "Images were acquired, but the note never says what they showed.",
    how:
      "Record the interpreting dentist's findings — even 'no significant findings' — or the " +
      "referral for interpretation. An image without an interpretation reads as an image nobody looked at."
  },
  {
    id: "complete.anesthetic-no-amount",
    trigger:
      /\b(?:lidocaine|articaine|septocaine|mepivacaine|carbocaine|bupivacaine|marcaine|prilocaine)\b|\blocal\s+anesthe(?:tic|sia)\b[^.\n]{0,40}\b(?:administered|given|delivered|injected)\b/i,
    satisfiedBy: /\b\d+(?:\.\d+)?\s*(?:carpules?|cartridges?|mg|mL|ml)\b|\b(?:one|two|three|four)\s+(?:carpules?|cartridges?)\b/i,
    what: "An anesthetic is named, but no amount is recorded.",
    how:
      "State the amount (carpules or milligrams) and the concentration. The amount administered " +
      "is a Tennessee minimum-record element for pharmaceuticals."
  },
  {
    id: "complete.extraction-no-outcome",
    trigger: /\b(?:extraction|extracted)\b/i,
    satisfiedBy:
      /\b(?:without\s+complication|no\s+complication|uneventful|complication[s]?\s*:|hemostasis|post-?op(?:erative)?\s+instructions?|gauze|socket)\b/i,
    what: "An extraction is documented with no outcome, complications statement, or post-operative instructions.",
    how:
      "State whether a complication was observed during the recorded period, that hemostasis was " +
      "achieved (with the observation), and that post-operative instructions were given. These are " +
      "the first three questions a later reader asks about any extraction."
  },
  {
    id: "complete.rx-no-duration",
    trigger:
      /\b(?:prescribed|prescription|dispensed?)\b[^.\n]{0,80}\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|doxycycline|ibuprofen|naproxen|acetaminophen|hydrocodone|oxycodone|codeine|tramadol|chlorhexidine|fluconazole|nystatin)\b/i,
    satisfiedBy:
      /\b(?:for|x)\s*\d+\s*(?:days?|weeks?)\b|\bday\s+supply\b|\buntil\s+(?:finished|gone|follow)/i,
    what: "A prescription is recorded without a duration or supply.",
    how: "State the course ('for 7 days', '× 5 days', 'until finished'). Dose, frequency, and duration together are what make a prescription reconstructible."
  },
  {
    id: "complete.consent-no-decision",
    trigger: /\b(?:consent|risks?\s+and\s+benefits?|treatment\s+options?)\s+(?:was\s+|were\s+)?(?:discussed|reviewed|presented|explained)\b/i,
    satisfiedBy:
      /\b(?:consented|consent\s+(?:was\s+)?(?:obtained|given|signed|recorded)|agreed|accepted|declined|refused|chose|elected|deferred)\b/i,
    what: "A consent conversation is documented without the patient's decision.",
    how: "Record what the patient decided — agreed, declined, or deferred — in their own terms. A discussion without a decision is half a consent record."
  }
];

export function runCompletenessRules(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const rule of RULES) {
    if (!new RegExp(rule.trigger.source, rule.trigger.flags).test(text)) continue;
    if (new RegExp(rule.satisfiedBy.source, rule.satisfiedBy.flags).test(text)) continue;
    findings.push({
      ruleId: rule.id,
      category: "required",
      severity: "S2",
      message: `${rule.what} A later reader — a colleague, an auditor, an attorney — will ask.`,
      suggestion: rule.how,
      occurrences: 1
    });
  }
  return findings;
}
