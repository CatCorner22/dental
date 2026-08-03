import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { MISSPELLINGS, MEDICATION_WORDS } from "@/lib/vocab/misspellings";
import { VAGUE_PHRASES, STALE_PHRASES } from "@/lib/vocab/vague-phrases";
import { SHORTHAND, SHORTHAND_OWNS } from "@/lib/vocab/shorthand";

// Paste-to-standard: the "writing on rails" pass, moved out of the companion
// skill and into the app.
//
// THE GOVERNING SPLIT, and the reason this module is worth reading before
// changing: a rewrite is either DETERMINISTIC or it is a JUDGEMENT CALL, and
// those two must never be mixed.
//
//   APPLIED — the replacement is fixed, language-only, and adds no clinical
//   claim. "x-ray" is always "radiograph". "abcess" is always "abscess".
//   Nothing about the patient changes; only the wording does.
//
//   FLAGGED — the correct replacement needs facts that the shorthand is
//   hiding. "PA" could be a periapical radiograph or a posteroanterior
//   cephalometric one. "tolerated well" needs the observed response. A
//   medication-name typo could be two different drugs. Guessing here would
//   invent clinical content, so the tool refuses and asks.
//
// Two rules fall out of that split and are enforced by tests:
//   1. A medication-name typo is NEVER auto-corrected, even though it sits in
//      the same misspelling table as everything else. "amoxicilin" is almost
//      certainly amoxicillin — but "almost certainly" is not a standard a drug
//      name is allowed to be corrected on.
//   2. Nothing here writes a clinical assertion, adds a finding, or removes a
//      negation. The output says exactly what the input said, in standard words.
//
// The result is a PROPOSAL. The person reads the itemised list and chooses to
// accept it. That is what keeps "no suggestion is ever auto-applied" true while
// still making this a one-click tool.

export interface AppliedChange {
  kind: "spelling" | "abbreviation" | "shorthand" | "formatting";
  from: string;
  to: string;
  count: number;
  why: string;
}

export interface RaisedFlag {
  kind:
    | "abbreviation"
    | "ambiguous-shorthand"
    | "vague-phrase"
    | "stale-text"
    | "medication-spelling";
  display: string;
  guidance: string;
  count: number;
}

export interface StandardizeResult {
  text: string;
  applied: AppliedChange[];
  flags: RaisedFlag[];
  /** True when the text is already standard: nothing applied, nothing flagged. */
  clean: boolean;
}

const MAX_INPUT = 20000;

// Collapse runs of whitespace but keep paragraph breaks, which carry meaning in
// a clinical note (one paragraph per phase of the visit).
function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    // Invisible characters that survive a copy-paste out of a PDF or an EDR and
    // then defeat every downstream match. Written as escapes, not literals:
    // a source file holding real zero-width bytes is unreviewable in a diff.
    .replace(/[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    // Smart punctuation to ASCII: an em-dash or curly quote pasted from Word
    // renders inconsistently and breaks naive matching later.
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // A space before terminal punctuation, and a missing one after.
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=[A-Za-z])/g, "$1 ")
    .trim();
}

// Sentence case. Typed notes arrive in lowercase far more often than not, and a
// note that opens mid-case reads as unfinished to whoever audits it later.
// Capitalising the first letter of a sentence changes no meaning and adds no
// claim, so it belongs in the applied half.
//
// Only the letter AFTER a sentence terminator or a line start is touched.
// Nothing mid-sentence is altered, so "mesial" never becomes "Mesial" and an
// intentionally lowercase term survives.
function sentenceCase(input: string): string {
  return input
    .split("\n")
    .map((line) => {
      if (/^[-*#|>]/.test(line.trim())) return line; // headings and list markers
      return line
        .replace(/^(\s*)([a-z])/, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
        .replace(
          /([.!?])(\s+)([a-z])/g,
          (_m, dot: string, gap: string, ch: string) => dot + gap + ch.toUpperCase()
        );
    })
    .join("\n");
}

// A measurement and its unit are separate tokens: "500mg" is one word to a
// reader skimming for a dose. Bounded to the units the practice actually
// writes, so a tooth designation or a date is never split.
const UNIT_GLUE = /\b(\d+(?:\.\d+)?)(mg|mcg|g|kg|ml|mm|cm|mL|%)\b/g;

function spaceUnits(input: string): string {
  return input.replace(UNIT_GLUE, "$1 $2");
}

// Sentence-final punctuation. A note that ends mid-thought reads as truncated,
// and a reader cannot tell whether content was lost.
function ensureTerminalPeriod(input: string): string {
  return input
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return t;
      // Leave list markers and headings alone; they are not sentences.
      if (/^[-*#|>]/.test(t)) return t;
      if (/[.!?:;]$/.test(t)) return t;
      return `${t}.`;
    })
    .join("\n");
}

// Case-preserving replacement: "X-ray" → "Radiograph" at the start of a
// sentence, "radiograph" mid-sentence. Replacing blind would produce
// "The radiograph shows" and "radiograph shows" inconsistently.
function matchCase(sample: string, replacement: string): string {
  // All-caps propagates only to a single-word replacement. An initialism like
  // "RCT" expanding to a phrase must not become "ROOT CANAL THERAPY" — the
  // source being capitals says it was an abbreviation, not that it was shouted.
  const oneWord = !replacement.includes(" ");
  if (oneWord && sample === sample.toUpperCase() && sample.length > 1) {
    return replacement.toUpperCase();
  }
  if (sample[0] === sample[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function bump<T extends { count: number }>(list: T[], key: (x: T) => string, item: T): void {
  const found = list.find((x) => key(x) === key(item));
  if (found) found.count += item.count;
  else list.push(item);
}

export function standardize(raw: string): StandardizeResult {
  const applied: AppliedChange[] = [];
  const flags: RaisedFlag[] = [];

  const input = typeof raw === "string" ? raw.slice(0, MAX_INPUT) : "";
  const whitespaced = normalizeWhitespace(input);
  if (whitespaced !== input.trim()) {
    applied.push({
      kind: "formatting",
      from: "inconsistent spacing and punctuation",
      to: "normalized",
      count: 1,
      why: "Collapsed stray spacing, straightened pasted quotes and dashes, and removed invisible characters."
    });
  }

  let text = whitespaced;

  // ---- Spelling. Whole words only, case-preserving.
  for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
    const re = new RegExp(`\\b${wrong}\\b`, "gi");
    const hits = text.match(re);
    if (!hits) continue;
    // Rule 1: a drug name is never silently corrected.
    if (MEDICATION_WORDS.has(right.toLowerCase())) {
      bump(flags, (f) => f.display, {
        kind: "medication-spelling",
        display: hits[0],
        guidance: `This looks like a misspelling of "${right}", but medication names are never corrected automatically. Confirm the drug against the source record and fix it by hand.`,
        count: hits.length
      });
      continue;
    }
    text = text.replace(re, (m) => matchCase(m, right));
    bump(applied, (a) => `${a.kind}:${a.from}`, {
      kind: "spelling",
      from: hits[0],
      to: right,
      count: hits.length,
      why: "Standard spelling from the practice lexicon."
    });
  }

  // ---- Shorthand: expand on FIRST USE, define parenthetically, then leave it.
  //
  // "Root canal therapy (RCT) was started. The RCT was completed later."
  //
  // Expanding every occurrence would be worse than leaving them: a note that
  // says "root canal therapy" six times reads like a form letter, and clinicians
  // stop using the tool. Expanding once and defining the term keeps the note
  // readable to an outsider AND natural to write.
  for (const sh of SHORTHAND) {
    const re = new RegExp(sh.pattern.source, sh.pattern.flags);
    const hits = text.match(re);
    if (!hits) continue;

    if (sh.alternatives) {
      // More than one real reading. Asserting one would put a clinical claim in
      // the note that the writer never made.
      bump(flags, (f) => f.display, {
        kind: "ambiguous-shorthand",
        display: sh.display,
        guidance: `"${sh.display}" has more than one meaning here: ${sh.alternatives.join("; ")}. Write the one you mean.`,
        count: hits.length
      });
      continue;
    }

    // Already defined somewhere in this text? Then the convention is satisfied
    // and re-expanding would produce "root canal therapy (RCT) (RCT)".
    const defined = new RegExp(
      `${sh.expansion.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\(${sh.display}\\)`,
      "i"
    );
    if (defined.test(text)) continue;

    let first = true;
    text = text.replace(re, (m) => {
      if (!first) return m;
      first = false;
      // Sentence-initial gets a capital; mid-sentence stays lower.
      return `${sh.expansion} (${m})`;
    });
    bump(applied, (a) => `${a.kind}:${a.from}`, {
      kind: "shorthand",
      from: sh.display,
      to: `${sh.expansion} (${sh.display})`,
      count: 1,
      why:
        hits.length > 1
          ? `Defined on first use; the remaining ${hits.length - 1} stay as "${sh.display}".`
          : "Defined on first use."
    });
  }

  // ---- Abbreviations. Only the deterministic ones are applied.
  for (const abbr of BANNED_ABBREVIATIONS) {
    // Owned by the shorthand table above, which defines it on first use rather
    // than replacing every occurrence. Running both would double-process the
    // same initialism.
    if (SHORTHAND_OWNS.has(abbr.id)) continue;
    const re = new RegExp(abbr.pattern.source, abbr.pattern.flags);
    const hits = text.match(re);
    if (!hits) continue;
    if (abbr.severityClass === "style") {
      text = text.replace(re, (m) => matchCase(m, abbr.replacement));
      bump(applied, (a) => `${a.kind}:${a.from}`, {
        kind: "abbreviation",
        from: abbr.display,
        to: abbr.replacement,
        count: hits.length,
        why: "Ambiguous shorthand with one standard expansion."
      });
    } else {
      // The expansion depends on facts the shorthand hides. Asking is correct.
      bump(flags, (f) => f.display, {
        kind: "abbreviation",
        display: abbr.display,
        guidance: `Write the exact term: ${abbr.replacement}. Only the clinician knows which one this was.`,
        count: hits.length
      });
    }
  }

  // ---- Vague and stale phrases. Never rewritten — the replacement IS the
  // clinical content, and inventing it is the one thing this tool must not do.
  for (const [list, kind] of [
    [VAGUE_PHRASES, "vague-phrase"],
    [STALE_PHRASES, "stale-text"]
  ] as const) {
    for (const phrase of list) {
      const re = new RegExp(phrase.pattern.source, phrase.pattern.flags);
      const hits = text.match(re);
      if (!hits) continue;
      bump(flags, (f) => f.display, {
        kind,
        display: phrase.display,
        guidance: phrase.replacement,
        count: hits.length
      });
    }
  }

  // Presentation last, so the replacements above matched against the text as
  // typed rather than against a half-reformatted version of it.
  const beforePresentation = text;
  text = ensureTerminalPeriod(spaceUnits(sentenceCase(text)));
  if (text !== beforePresentation && !applied.some((a) => a.kind === "formatting")) {
    applied.push({
      kind: "formatting",
      from: "sentence case, spacing, and terminal punctuation",
      to: "normalized",
      count: 1,
      why: "Capitalized sentences, separated units from their numbers, and closed the final sentence."
    });
  }

  return {
    text,
    applied,
    flags,
    clean: applied.length === 0 && flags.length === 0
  };
}
