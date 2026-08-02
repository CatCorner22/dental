import type { AuditFinding } from "../types";
import { DENTAL_LEXICON } from "@/lib/vocab/lexicon-dental";
import { COMMON_LEXICON } from "@/lib/vocab/lexicon-common";
import { GENERATED_LEXICON } from "@/lib/vocab/lexicon-generated";
import { MEDICATION_WORDS, MISSPELLINGS } from "@/lib/vocab/misspellings";

// Safe-edit boundary: a medication-name typo stays S2 REVIEW until a
// clinician verifies the source. Other high-confidence typos are S3 STYLE.
// Unknown words are S4 INFO only — the office lexicon cannot know every word.

const MAX_UNKNOWN_WORD_FINDINGS = 15;

function inAnyLexicon(word: string): boolean {
  return DENTAL_LEXICON.has(word) || COMMON_LEXICON.has(word) || GENERATED_LEXICON.has(word);
}

function known(word: string): boolean {
  if (inAnyLexicon(word)) return true;
  // Naive plural/verb endings. "d" handles the -ed form of an e-ending stem
  // ("suture" -> "sutured"); for "ed"/"ing" we also restore the dropped "e"
  // ("suture" -> "suturing") so common verb forms are not flagged as typos.
  for (const suffix of ["s", "es", "ed", "ing", "ly", "d"]) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    if (stem.length < 3) continue;
    if (inAnyLexicon(stem)) return true;
    if ((suffix === "ed" || suffix === "ing") && inAnyLexicon(stem + "e")) return true;
  }
  return false;
}

function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    let rowMin = dp[0];
    for (let i = 1; i <= a.length; i++) {
      const cur = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
      rowMin = Math.min(rowMin, dp[i]);
    }
    if (rowMin > max) return false;
  }
  return dp[a.length] <= max;
}

function closeDentalTerm(word: string): string | undefined {
  const max = word.length >= 8 ? 2 : 1;
  for (const term of DENTAL_LEXICON) {
    if (term.length >= 5 && editDistanceAtMost(word, term, max)) return term;
  }
  return undefined;
}

export function runSpellingRule(
  text: string,
  fieldRef?: { moduleId: string; fieldId: string }
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seen = new Set<string>();
  let unknownCount = 0;
  // Also capture ALL-CAPS words so a shouted medication typo ("AMOXICILIN")
  // still reaches the medication check. Their generic unknown-word finding is
  // suppressed below so ordinary acronyms (EDR, BWX, PARL) stay quiet.
  for (const m of text.matchAll(/[A-Za-z][A-Za-z']{2,}/g)) {
    const raw = m[0];
    const isAllCaps = raw.length >= 2 && raw === raw.toUpperCase();
    const word = raw.toLowerCase().replace(/'s?$/, "");
    if (word.length < 3 || seen.has(word)) continue;
    seen.add(word);

    const correction = MISSPELLINGS[word];
    if (correction) {
      const medication = MEDICATION_WORDS.has(correction);
      findings.push({
        ruleId: medication ? "spelling.medication" : "spelling.known-misspelling",
        category: "spelling",
        severity: medication ? "S2" : "S3",
        message: medication
          ? `"${raw}" looks like a misspelled medication name. A clinician verifies the drug against the source record before any correction.`
          : `"${raw}" looks misspelled.`,
        matchedText: raw,
        suggestion: correction,
        fieldRef
      });
      continue;
    }
    if (known(word)) continue;

    const close = closeDentalTerm(word);
    if (close) {
      const medication = MEDICATION_WORDS.has(close);
      findings.push({
        ruleId: medication ? "spelling.medication" : "spelling.close-match",
        category: "spelling",
        severity: medication ? "S2" : "S3",
        message: medication
          ? `"${raw}" is close to the medication name "${close}". A clinician verifies the drug against the source record before any correction.`
          : `"${raw}" may be a misspelling of "${close}".`,
        matchedText: raw,
        suggestion: close,
        fieldRef
      });
      continue;
    }

    if (!isAllCaps && word.length >= 5 && unknownCount < MAX_UNKNOWN_WORD_FINDINGS) {
      unknownCount++;
      findings.push({
        ruleId: "spelling.unknown-word",
        category: "spelling",
        severity: "S4",
        message: `"${raw}" is not in the office word list. Check the spelling.`,
        matchedText: raw,
        fieldRef
      });
    }
  }
  return findings;
}
