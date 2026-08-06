/**
 * No shouting.
 *
 * This app does not render text in all capitals. Not section labels, not table
 * headers, not severity chips, not status banners. The rule is Kenneth Adams'
 * on drafting: all-caps does not make text conspicuous, it makes it harder to
 * read. Readers recognise words by their shape — ascenders, descenders, the
 * outline of the whole word — and capitals flatten every word into the same
 * rectangle, so an all-caps line has to be decoded letter by letter. A block of
 * capitals is therefore the one typographic device that is simultaneously
 * louder and less legible, which is a bad trade anywhere and a worse one on a
 * screen where somebody is trying to get a clinical note right.
 *
 * What replaces it is what should have been carrying the emphasis all along:
 * weight, size, colour, and space. See `.label-section` / `.label-micro` /
 * `.eyebrow` in globals.css.
 *
 * This module holds the rule; casing.test.ts enforces it across the source
 * tree so it cannot creep back one component at a time.
 */

/**
 * Capitals that are not shouting.
 *
 * An acronym is not an all-caps word — it is a word whose letters are each
 * standing in for something, and lowercasing it changes what it says. "PHI" is
 * not "phi". Sentence case has never applied to these and Adams does not say
 * it should.
 *
 * Kept deliberately short. Anything added here is a claim that a reader will
 * parse the letters individually, so a real acronym qualifies and an ordinary
 * word typed in capitals for emphasis does not.
 */
export const ALLOWED_ACRONYMS = new Set([
  // Clinical and regulatory
  "PHI",
  "SOAP",
  "HIPAA",
  "ADA",
  "CDT",
  "ASA",
  "MRN",
  "DOB",
  "SSN",
  "NPI",
  "TCA",
  "TN",
  "RDH",
  "RDA",
  "DDS",
  "DMD",
  "BOP",
  "PSR",
  "TMJ",
  "TMD",
  "CBCT",
  "SDF",
  "COE",
  "FMX",
  "BWX",
  "PA",
  "OHI",
  "NKDA",
  "NKA",
  "NPO",
  "IV",
  "BP",
  "HR",
  "N2O",
  // Product and technical
  "EDR",
  "EHR",
  "AI",
  "ML",
  "LLM",
  "API",
  "URL",
  "PDF",
  "CSV",
  "UI",
  "UX",
  "ID",
  "OK",
  "CI",
  "MFA",
  "SMS",
  // The severity taxonomy codes. S0..S4 are identifiers in the ruleset and the
  // frozen report, not words — they are handled by the digit rule below, and
  // named here so a reader of this list is not left wondering.
  "S0",
  "S1",
  "S2",
  "S3",
  "S4"
]);

/**
 * A shouted word: two or more letters, all capital, that is not an allowed
 * acronym.
 *
 * Two, not three. "OK" and "NO" are both two letters and only one of them is
 * an acronym; the allowlist is what separates them, so the pattern's job is
 * only to find candidates.
 */
const CANDIDATE = /\b[A-Z][A-Z]+\b/g;

/**
 * Every shouted word in a string, in order, with duplicates kept.
 *
 * Returns an array rather than a boolean so a failing test can name what it
 * found. Callers that only want a yes/no can check `.length`.
 */
export function findShouting(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(CANDIDATE)) {
    const word = m[0];
    if (ALLOWED_ACRONYMS.has(word)) continue;
    out.push(word);
  }
  return out;
}

/** Whether a string is free of shouted words. */
export function isUnshouted(text: string): boolean {
  return findShouting(text).length === 0;
}
