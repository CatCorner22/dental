// Text normalization for the meaning verifier.
//
// Every check downstream compares what the model wrote against what the writer
// typed. That comparison is only as good as the tokenizer feeding it, and the
// red-team probe showed the tokenizer was the softest part of the wall: a
// fabricated dose written in Arabic-Indic digits (٥٠٠) and a fabricated tooth
// number written in fullwidth digits (１９) both walked straight through, because
// JavaScript's \d matches ASCII only. The output "gained" no digits as far as
// the digit check could see, so the digit check had nothing to compare.
//
// A denylist of confusable characters is unwinnable — the audit engine already
// learned that lesson about invisible characters and wrote it down. So this
// folds the text to one canonical form FIRST and lets every check run against
// that, rather than teaching each check about Unicode separately.

import { visibleText } from "@/lib/audit/engine";
import { foldDigits } from "@/lib/text/foldDigits";

/**
 * Fold text to the form every check compares against.
 *
 * NFKC does the heavy lifting: it maps fullwidth Latin and digits, ligatures,
 * and most compatibility forms onto their ASCII equivalents. `visibleText`
 * strips the zero-width and format characters NFKC leaves alone — reused rather
 * than reimplemented so the verifier and the PHI attestation validator can never
 * disagree about what "renders" means. The digit pass afterwards catches the
 * decimal scripts NFKC does NOT fold, which is all of them: NFKC preserves
 * ٥ and ५ and ๕ exactly as they are, because they are not compatibility
 * characters — they are different digits that mean the same number.
 */
export function canonical(text: string): string {
  return foldDigits(visibleText(text.normalize("NFKC")));
}

/**
 * Map every Unicode decimal digit onto its ASCII counterpart.
 *
 * \p{Nd} is the whole Number/decimal-digit category, so this covers Arabic
 * Indic, Devanagari, Thai, Bengali, fullwidth and the rest without naming any
 * of them. The value of a decimal digit is its offset from the zero of its own
 * block, and codePointAt arithmetic recovers that without a lookup table.
 */

/** Lowercased alphabetic tokens. Digits are compared separately and exactly. */
export function words(text: string): string[] {
  return canonical(text).toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

/**
 * A crude stem, so "restore" / "restored" / "restoring" / "restoration" all
 * compare equal.
 *
 * Deliberately not a real stemmer. The grounding check asks "did this word come
 * from somewhere", and for that question over-stemming is safe (it grounds a
 * word that was already close to a real one) while under-stemming produces
 * false alarms on ordinary grammar fixes. The same suffix-stripping shape the
 * spelling rule already uses, kept in step with it on purpose.
 */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/['-]/g, "");
  for (const suffix of ["ations", "ation", "ings", "ing", "ies", "ied", "ees", "ed", "es", "s", "ly"]) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  // "restor" from restoration and "restore" from restored must meet.
  return w.replace(/e$/, "");
}

export function stems(text: string): Set<string> {
  return new Set(words(text).map(stem));
}

/**
 * Split into the clauses a claim can live in.
 *
 * Sentence terminators AND the internal punctuation that separates independent
 * assertions, because "No swelling; tenderness present" is two claims and the
 * negation-scope check has to see the semicolon or it will read the negation as
 * covering both.
 */
export function clauses(text: string): string[] {
  return canonical(text)
    .split(/(?<=[.!?])\s+|[;:\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
