import type { AuditFinding } from "../types";

// Effort enforcement. A clinical note is testimony, and testimony has a
// floor. These rules catch the note that was typed to satisfy the FIELD
// rather than the RECORD — keyboard mash, filler, and unprofessional
// characterization of the patient.
//
// The tone rule for every message here: cold logic, zero condescension. The
// note is blocked because a reader cannot use it, not because the author is
// bad. Say what a reader needs, and stop.

// Keyboard mash: one character repeated, or a run straight along a keyboard
// row. "asdf", "qwer", "zxcv" typed to fill a box appear in real audit
// findings across every documentation system ever deployed.
const MASH_PATTERNS: RegExp[] = [
  /(.)\1{5,}/, // aaaaaa
  /\b(?:asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm)[a-z]*\b/i,
  /\b(?:test(?:ing)?\s*){2,}\b/i,
  /\b(?:blah\s*){2,}\b/i,
  /\b(?:xxx+|zzz+|nnn+)\b/i
];

export function runGibberishRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const pattern of MASH_PATTERNS) {
    const m = pattern.exec(text);
    if (!m) continue;
    findings.push({
      ruleId: "effort.gibberish",
      category: "template-residue",
      severity: "S1",
      message:
        `"${m[0].slice(0, 30)}" is filler, not documentation. A reader three years from now ` +
        `gets exactly what is typed here and nothing else.`,
      matchedText: m[0].slice(0, 30),
      suggestion: "Replace the filler with what actually happened, or delete the line.",
      occurrences: 1
    });
    break; // one finding is the message; ten is nagging
  }
  return findings;
}

// Unprofessional characterization: wording that describes the PERSON instead
// of the VISIT. Complements the stigmatizing list (which covers clinical
// framing like "drug-seeking") with the plainly rude register that shows up
// when a note is written in frustration. Every one of these has been read
// aloud in a courtroom.
const RUDE: { pattern: RegExp; display: string }[] = [
  { pattern: /\b(?:crazy|insane|nuts|psycho|lunatic)\b/gi, display: "characterizing the patient's mental state" },
  { pattern: /\b(?:stupid|idiot(?:ic)?|moron(?:ic)?|dumb)\b/gi, display: "an insult" },
  { pattern: /\b(?:annoying|whiny|whining|dramatic|hysterical)\b/gi, display: "characterizing the patient's manner" },
  { pattern: /\b(?:liar|lying|lies)\b/gi, display: "an accusation of dishonesty" },
  { pattern: /\b(?:lazy|filthy|disgusting|gross)\b/gi, display: "a judgment of the patient" },
  { pattern: /\bfat\b/gi, display: "a slur where a clinical term exists" }
];

export function runProfessionalToneRule(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const rule of RUDE) {
    const m = new RegExp(rule.pattern.source, rule.pattern.flags).exec(text);
    if (!m) continue;
    findings.push({
      ruleId: "effort.unprofessional",
      category: "stigmatizing",
      severity: "S1",
      message:
        `"${m[0]}" reads as ${rule.display}. A note documents the visit, never characterizes ` +
        `the person — and this exact wording is what gets projected in front of a jury.`,
      matchedText: m[0],
      suggestion:
        "State the observable behavior or clinical finding instead: what was said, what was " +
        "seen, what was measured.",
      occurrences: 1
    });
  }
  return findings;
}

export function runEffortRules(text: string): AuditFinding[] {
  return [...runGibberishRule(text), ...runProfessionalToneRule(text)];
}
