// WHAT THE TOOL DOES NOT UNDERSTAND, ranked by how often it appears.
//
// The preloaded national vocabulary gets most of the way. The rest is local and
// always will be: a shorthand one hygienist uses, a material only this practice
// stocks, a room name, an initialism a specialist referral letter introduced. No
// published list will ever contain them, and hand-auditing notes to find them is
// work nobody will do twice.
//
// So count them. A token the tool cannot expand, cannot flag, and cannot even
// recognise as a word is a token that will read as noise to whoever opens the
// record in five years — and if it appears forty times this month it is part of
// the practice's working vocabulary and belongs in the table.
//
// NO NEW LOGGING, and that constraint shaped the whole design. The obvious
// implementation is to record unrecognised tokens as they are typed, and it is
// wrong: an abbreviation is note content, and this application's contract is that
// note text is never written to a log. Instead this reads the submissions the
// practice ALREADY stores, which is data it already holds, already frozen, and
// already visible to exactly the roles that can read every note anyway. Counting
// something you already have is not a new privacy surface.
//
// Nothing here changes a rule. It produces a ranked list for a human to look at,
// with a route to the change-request queue — the same human-ratified loop the
// rule-disagreement stats already use, and the same reason: this tool's error
// signal is reviewed by people, never applied by itself.

import { COMMON_LEXICON } from "./lexicon-common";
import { DENTAL_LEXICON } from "./lexicon-dental";
import { GENERATED_LEXICON } from "./lexicon-generated";
import { MEDICATION_WORDS } from "./misspellings";
import { BANNED_ABBREVIATIONS } from "./abbreviations";
import { SHORTHAND } from "./shorthand";

export interface UnknownAbbreviation {
  /** The token as it appeared, lower-cased. */
  token: string;
  /** How many times it appeared across the notes scanned. */
  count: number;
  /** How many separate notes it appeared in — the signal that it is shared. */
  notes: number;
}

/**
 * Tokens that LOOK like clinical shorthand rather than prose.
 *
 * Deliberately narrow. The spelling rule already reports unknown WORDS at S4;
 * this is after something different — a construct that is not trying to be a
 * word. Three shapes qualify:
 *
 *   - written in capitals ("PFZ", "OVD"), the ordinary form of an initialism;
 *   - containing a slash or internal period ("s/p", "b.i.d."), which prose does
 *     not do;
 *   - short and vowel-free ("bwx", "prn"), which English words are not.
 *
 * Everything else is either a real word, a misspelling the spelling rule owns, or
 * a proper noun — and a screen that reports all of those is a screen nobody reads.
 */
function abbreviationShaped(raw: string): boolean {
  const letters = raw.replace(/[^A-Za-z]/g, "");
  if (letters.length < 2 || letters.length > 6) return false;
  if (/[/.]/.test(raw)) return true;
  if (raw === raw.toUpperCase()) return true;
  return !/[aeiouy]/i.test(letters);
}

/** Every token any vocabulary table already matches, so it is not unknown. */
function isAlreadyKnownToTables(token: string): boolean {
  for (const a of BANNED_ABBREVIATIONS) {
    a.pattern.lastIndex = 0;
    const hit = a.pattern.test(token);
    a.pattern.lastIndex = 0;
    if (hit) return true;
  }
  for (const s of SHORTHAND) {
    s.pattern.lastIndex = 0;
    const hit = s.pattern.test(token);
    s.pattern.lastIndex = 0;
    if (hit) return true;
  }
  return false;
}

/**
 * Drop the frozen submission stamp before counting anything.
 *
 * A filed note carries the tool's own metadata appended under a
 * "## Submission record" heading: the ticket, the submitter, the Eastern
 * timestamp, the ruleset version. Scanned along with the clinical text, the very
 * first thing this panel reported was "dn" — the DN-000034 ticket prefix — as
 * shorthand the practice uses and the tool cannot read. Which is true, absurd, and
 * exactly the kind of finding that teaches a Team Lead to stop opening the page.
 *
 * Split on the app's own delimiter rather than guessing at token shapes, because
 * the delimiter is a fact and a heuristic about "DN" would not survive the next
 * ticket format.
 */
function withoutSubmissionStamp(text: string): string {
  const i = text.indexOf("\n## Submission record");
  return i === -1 ? text : text.slice(0, i);
}

function isKnownWord(token: string): boolean {
  const w = token.toLowerCase().replace(/[^a-z]/g, "");
  return (
    DENTAL_LEXICON.has(w) ||
    COMMON_LEXICON.has(w) ||
    GENERATED_LEXICON.has(w) ||
    MEDICATION_WORDS.has(w)
  );
}

/**
 * Rank the shorthand this practice uses that the tool cannot read.
 *
 * `minNotes` is the whole difference between a signal and a list of typos. A
 * token appearing in one note is somebody's slip; the same token in five notes is
 * vocabulary, and only the second is worth a Team Lead's attention or a change
 * request.
 */
export function unknownAbbreviations(
  noteTexts: string[],
  opts: { minNotes?: number; limit?: number } = {}
): UnknownAbbreviation[] {
  const minNotes = opts.minNotes ?? 2;
  const limit = opts.limit ?? 20;
  const counts = new Map<string, { count: number; notes: Set<number> }>();

  noteTexts.forEach((raw, index) => {
    const text = withoutSubmissionStamp(raw);
    // Tokens may carry a slash or internal periods, which the ordinary word
    // pattern would split apart and hide.
    for (const m of text.matchAll(/[A-Za-z][A-Za-z./]*[A-Za-z]/g)) {
      const raw = m[0];
      if (!abbreviationShaped(raw)) continue;
      if (isKnownWord(raw)) continue;
      if (isAlreadyKnownToTables(raw)) continue;
      const key = raw.toLowerCase();
      const entry = counts.get(key) ?? { count: 0, notes: new Set<number>() };
      entry.count++;
      entry.notes.add(index);
      counts.set(key, entry);
    }
  });

  return [...counts.entries()]
    .map(([token, e]) => ({ token, count: e.count, notes: e.notes.size }))
    .filter((e) => e.notes >= minNotes)
    // Spread across notes first, then raw frequency: a term four people use
    // matters more than one somebody typed eight times in a single note. Token
    // last so the order is stable for a reader comparing two weeks.
    .sort((a, b) => b.notes - a.notes || b.count - a.count || a.token.localeCompare(b.token))
    .slice(0, limit);
}
