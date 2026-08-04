// EVIDENCE REDACTION BY ALLOW-LIST — the inversion that makes this safe.
//
// ===========================================================================
// THE PROBLEM. A learning proposal is only reviewable if the reviewer can see
// EVIDENCE: "this token appeared 37 times, here is how it was used." But the
// places it was used are clinical notes, and this application's contract is
// that note text never leaves the record it was filed in. A proposal carrying
// a raw quote is a PHI leak wearing a lab coat.
//
// THE USUAL ANSWER IS A DENY-LIST — scan the quote for names, dates, record
// numbers, redact what you find. Every PHI screen in this codebase works that
// way and they are right to, because they are screening text a human wrote and
// must not block that human's work over a false positive.
//
// THAT IS THE WRONG SHAPE HERE, and the reason is which way each one fails. A
// deny-list fails OPEN: it misses the name nobody put on the list, the
// nickname, the misspelling, the surname that is also a common noun. That is
// tolerable when a human is about to read the result anyway and the cost of
// over-blocking is a stalled note. It is not tolerable in an artifact that
// gets stored, aggregated, and shown to people outside the treating
// relationship.
//
// So this inverts it. A token survives ONLY IF IT IS IN A CONTROLLED TABLE —
// the clinical lexicons, the shorthand table, the unit list, the tooth
// designators. Everything else becomes a placeholder. A patient's name cannot
// survive that, not because we recognised it as a name, but because it is not
// in the dental lexicon and nothing that is not in the dental lexicon gets
// through.
//
// It fails CLOSED. The cost is that a legitimate clinical word missing from the
// tables shows as "___", which makes the evidence slightly harder to read. That
// is the correct trade for an artifact whose whole purpose is to be circulated.
// ===========================================================================

import { COMMON_LEXICON } from "@/lib/vocab/lexicon-common";
import { DENTAL_LEXICON } from "@/lib/vocab/lexicon-dental";
import { GENERATED_LEXICON } from "@/lib/vocab/lexicon-generated";
import { GIVEN_NAMES } from "@/lib/vocab/given-names";

/** The placeholder a non-allow-listed token becomes. */
export const REDACTED = "___";

/**
 * Numbers are redacted WHOLESALE, with no exception for "obviously clinical"
 * ones.
 *
 * The temptation is to keep small integers — a tooth number, a carpule count, a
 * probing depth — because they make the evidence far more readable. The reason
 * not to is that a date of birth, a record number's last four, an age over 89
 * (an identifier under HIPAA's own list) and a street number are all small
 * integers too, and the only thing separating them from a tooth number is the
 * surrounding words, which we have just redacted.
 *
 * A proposal does not need the number. It needs the SHAPE — that a number
 * appeared here — and "#" carries that.
 */
const NUMBER_PLACEHOLDER = "#";

function isAllowed(token: string): boolean {
  const lower = token.toLowerCase();
  // A given name is refused even when it is also a lexicon word. "Bill",
  // "Mark", "Rose", "Grant" and "Crown" are all names and all plausible in a
  // dental note, and in an artifact that gets circulated the name reading is
  // the one that matters.
  if (GIVEN_NAMES.has(lower)) return false;
  return COMMON_LEXICON.has(lower) || DENTAL_LEXICON.has(lower) || GENERATED_LEXICON.has(lower);
}

/**
 * Render a snippet of note text as circulation-safe evidence.
 *
 * Never throws, and on any input at all the worst case is a string of
 * placeholders.
 */
export function redactEvidence(snippet: string): string {
  return snippet
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) return " ";
      // Keep leading/trailing punctuation so the shape of the phrase survives;
      // it carries no identity on its own.
      const match = /^([^\p{L}\p{Nd}]*)(.*?)([^\p{L}\p{Nd}]*)$/su.exec(chunk);
      if (!match) return REDACTED;
      const [, lead, core, tail] = match;
      if (!core) return `${lead}${tail}`;
      if (/^\p{Nd}+$/u.test(core)) return `${lead}${NUMBER_PLACEHOLDER}${tail}`;
      if (/\p{Nd}/u.test(core)) return `${lead}${REDACTED}${tail}`;
      return `${lead}${isAllowed(core) ? core : REDACTED}${tail}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A window of `radius` words either side of `token` inside `text`, redacted.
 *
 * The token itself is preserved even though it is by definition NOT in the
 * lexicon — that is the whole reason it is being proposed. It is preserved
 * because the reviewer cannot rule on a proposal without seeing what is being
 * proposed, and because a token that has appeared in notes by several different
 * authors is practice jargon rather than a person.
 *
 * The AUTHOR THRESHOLD is what makes that safe and it is enforced in
 * proposals.ts, not here. A token used by one person once could be anything. A
 * token used by four people in nineteen notes is vocabulary.
 */
export function redactedContext(text: string, token: string, radius = 4): string | undefined {
  const words = text.split(/\s+/);
  const idx = words.findIndex((w) => w.toLowerCase().replace(/[^\p{L}\p{Nd}]/gu, "") === token.toLowerCase());
  if (idx < 0) return undefined;
  const from = Math.max(0, idx - radius);
  const to = Math.min(words.length, idx + radius + 1);
  const rendered = words
    .slice(from, to)
    .map((w, i) => (from + i === idx ? w.replace(/[^\p{L}\p{Nd}/'-]/gu, "") : redactEvidence(w)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return `${from > 0 ? "… " : ""}${rendered}${to < words.length ? " …" : ""}`;
}
