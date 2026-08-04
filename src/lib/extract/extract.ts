// THE CLAUSE PARSER — shorthand in, structured clinical facts out.
//
// Read the header of facts.ts first; the read-only invariant stated there is
// what makes this file safe to have at all.
//
// ===========================================================================
// THE GRAMMAR, in EBNF. Written down because a grammar that lives only in the
// control flow is a grammar nobody can review.
//
//   Clause      := Segment*
//   Segment     := SiteGroup | Procedure | <ignored>
//   SiteGroup   := ToothIntro ToothList Surfaces?
//   ToothIntro  := "#" | "tooth" | "teeth" | "no" "."
//   ToothList   := ToothRef ( ("," | "and" | "&") ToothRef )*
//                | ToothRef "-" ToothRef                     (* inclusive range *)
//   ToothRef    := UniversalNumber | PrimaryLetter
//   Surfaces    := UPPERCASE [MOIDBFL]+
//   Procedure   := <literal from vocab/procedures.ts, longest match>
//
// ===========================================================================
// THREE RULES THAT KEEP THIS HONEST
//
// 1. A BARE NUMBER IS NEVER A TOOTH. It must be introduced by "#", "tooth",
//    "teeth" or "no.", or continue a list that was. "2 carpules", "3 mm",
//    "16 units" and every date, count and measurement in a note are numbers in
//    exactly the same range as tooth designators, and the only thing that
//    distinguishes them is the word in front. This is the single most important
//    rule in the file.
//
// 2. AN INTRODUCER IS NOT ENOUGH EITHER. "Lot #4432", "Op #2", "chair #3" all
//    carry a hash. The negative-context list is shared with notation.ts, which
//    learned it the hard way.
//
// 3. SURFACES MUST BE UPPERCASE. "MOD" is a surface string; "mod" is a word,
//    and so are "do", "of", "bill", "lid" and "old" — every one of them a
//    plausible letter-run over {M,O,I,D,B,F,L}. Requiring the case the writer
//    used to signal notation costs us the writer who types lowercase, and the
//    alternative costs us a chart drawn from the word "do". The lowercase case
//    is recoverable later by ASKING; a wrong surface on a legal record is not.
//
// REFUSAL IS FREE AND IS THE DEFAULT. A clause that matches nothing contributes
// a span to `unparsed` and no facts. Nothing is repaired, nothing is guessed.

import { getTooth, allowedSurfaces } from "@/lib/vocab/teeth";
import { PROCEDURE_TERMS_BY_LENGTH, type ProcedureTerm } from "@/lib/vocab/procedures";
import type { Surface } from "@/lib/schema/types";
import { assertionFor } from "./context";
import { clauseRanges, tokenize, type Token } from "./tokenize";
import type { ClinicalFact, ExtractionResult, ProcedureFact, Span, ToothSite, ToothSiteFact } from "./facts";

/**
 * Words that make a following "#N" something other than a tooth.
 *
 * Kept in step with NOT_A_TOOTH_CONTEXT in standardize/notation.ts. Both lists
 * exist because operatory numbers, lot numbers and claim numbers live in the
 * same numeric range as tooth designators and read identically.
 */
const NOT_A_TOOTH_CONTEXT = new Set([
  "op",
  "operatory",
  "room",
  "chair",
  "lot",
  "batch",
  "ref",
  "reference",
  "invoice",
  "claim",
  "acct",
  "account",
  "order",
  "item",
  "serial",
  "model",
  "shade",
  "unit",
  "page",
  "box",
  "code"
]);

const TOOTH_INTRO_WORDS = new Set(["tooth", "teeth", "no"]);
const LIST_JOINERS = new Set([",", "&"]);
const SURFACE_LETTERS = new Set(["M", "O", "I", "D", "B", "F", "L"]);

function isToothNumberToken(t: Token): boolean {
  if (t.kind !== "number") return false;
  const digits = t.digits ?? t.text;
  if (!/^\d{1,2}$/.test(digits)) return false;
  const n = Number(digits);
  return n >= 1 && n <= 32;
}

function isPrimaryLetterToken(t: Token): boolean {
  return t.kind === "word" && /^[A-T]$/.test(t.text);
}

function toothIdOf(t: Token): string | undefined {
  if (isToothNumberToken(t)) return String(Number(t.digits ?? t.text));
  if (isPrimaryLetterToken(t)) return t.text.toUpperCase();
  return undefined;
}

/**
 * Read a surface string if the token at `i` is one.
 *
 * Validated against the tooth it attaches to: an occlusal surface on an
 * incisor is anatomically impossible, and so is an incisal surface on a molar.
 * Impossible surfaces are RECORDED, not dropped — the audit engine decides what
 * they mean, and this layer's contract is to report what the note said even
 * when what it said is wrong.
 */
function readSurfaces(
  tokens: Token[],
  i: number,
  toothId: string
): { surfaces: Surface[]; impossible: string[]; end: number } | undefined {
  const t = tokens[i];
  if (!t || t.kind !== "word") return undefined;
  if (t.text !== t.text.toUpperCase()) return undefined; // rule 3
  if (t.text.length < 1 || t.text.length > 5) return undefined;
  const letters = t.text.split("");
  if (!letters.every((c) => SURFACE_LETTERS.has(c))) return undefined;
  // A single letter is too weak a signal on its own: "#14 D" could be a distal
  // surface or an initial. Two or more letters is unambiguous notation.
  if (letters.length < 2) return undefined;
  if (new Set(letters).size !== letters.length) return undefined; // "MMO" is not notation

  const allowed = new Set(allowedSurfaces(toothId));
  const surfaces: Surface[] = [];
  const impossible: string[] = [];
  for (const c of letters) {
    const s = c as Surface;
    if (allowed.has(s)) surfaces.push(s);
    else impossible.push(c);
  }
  return { surfaces, impossible, end: i + 1 };
}

interface ParsedSites {
  sites: ToothSite[];
  /** Token index just past the group. */
  end: number;
  tokenFrom: number;
}

/**
 * Parse a site group starting at token `i`, or return undefined.
 */
function readSiteGroup(tokens: Token[], i: number, clauseEnd: number): ParsedSites | undefined {
  const start = i;
  const intro = tokens[i];
  if (!intro) return undefined;

  let cursor = i;
  if (intro.kind === "hash") {
    const prev = tokens[i - 1];
    if (prev && prev.kind === "word" && NOT_A_TOOTH_CONTEXT.has(prev.lower)) return undefined; // rule 2
    cursor = i + 1;
  } else if (intro.kind === "word" && TOOTH_INTRO_WORDS.has(intro.lower)) {
    cursor = i + 1;
    // "no" only introduces a tooth as "no." — bare "no" is the highest-yield
    // negation trigger in the literature and must not be eaten here.
    if (intro.lower === "no") {
      const dot = tokens[cursor];
      if (!dot || dot.kind !== "punct" || dot.text !== ".") return undefined;
      cursor++;
    }
  } else {
    return undefined;
  }

  const ids: Array<{ id: string; from: number; to: number }> = [];
  const readOne = (): boolean => {
    // A hash may repeat inside a list: "#3, #14".
    if (tokens[cursor]?.kind === "hash") cursor++;
    const tok = tokens[cursor];
    if (!tok || cursor >= clauseEnd) return false;
    const id = toothIdOf(tok);
    if (id === undefined) return false;
    ids.push({ id, from: cursor, to: cursor + 1 });
    cursor++;
    return true;
  };

  if (!readOne()) return undefined;

  // Range or list continuation.
  for (;;) {
    const joiner = tokens[cursor];
    if (!joiner || cursor >= clauseEnd) break;

    const isRange = joiner.kind === "punct" && (joiner.text === "-" || joiner.text === "–");
    const isList =
      (joiner.kind === "punct" && LIST_JOINERS.has(joiner.text)) ||
      (joiner.kind === "word" && joiner.lower === "and");
    if (!isRange && !isList) break;

    const save = cursor;
    cursor++;
    const before = ids.length;
    if (!readOne()) {
      cursor = save;
      break;
    }
    if (isRange && before > 0) {
      // Expand an inclusive range, permanent numbering only. Ranges across the
      // letter dentition, and ranges that run backwards, are refused rather
      // than interpreted: "T-C" has no single obvious reading.
      const from = Number(ids[before - 1].id);
      const to = Number(ids[before].id);
      if (Number.isInteger(from) && Number.isInteger(to) && to > from && to - from <= 15) {
        const inserted = ids.pop()!;
        for (let n = from + 1; n <= to; n++) {
          ids.push({ id: String(n), from: inserted.from, to: inserted.to });
        }
      }
    }
  }

  const sites: ToothSite[] = [];
  for (let k = 0; k < ids.length; k++) {
    const entry = ids[k];
    if (!getTooth(entry.id)) continue;
    let span: Span = { start: tokens[entry.from].start, end: tokens[entry.to - 1].end };
    let surfaces: Surface[] = [];
    let impossible: string[] = [];
    // Surfaces attach to the LAST tooth in a list ("#3, 14, 30 MOD" is read as
    // MOD on 30 only) unless the list has one member. That is conservative on
    // purpose: distributing surfaces across a list is a guess about intent.
    if (k === ids.length - 1) {
      const read = readSurfaces(tokens, cursor, entry.id);
      if (read) {
        surfaces = read.surfaces;
        impossible = read.impossible;
        span = { start: span.start, end: tokens[cursor].end };
        cursor = read.end;
      }
    }
    sites.push({ toothId: entry.id, surfaces, span, impossibleSurfaces: impossible });
  }

  if (sites.length === 0) return undefined;
  return { sites, end: cursor, tokenFrom: start };
}

function readProcedure(
  tokens: Token[],
  i: number,
  clauseEnd: number
): { term: ProcedureTerm; from: number; to: number } | undefined {
  for (const term of PROCEDURE_TERMS_BY_LENGTH) {
    const len = term.literal.length;
    if (i + len > clauseEnd) continue;
    let ok = true;
    for (let k = 0; k < len; k++) {
      if (tokens[i + k].lower !== term.literal[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return { term, from: i, to: i + len };
  }
  return undefined;
}

/**
 * Read a note into facts.
 *
 * Never throws and never returns text. On any input at all — empty, binary,
 * a paste of someone else's spreadsheet — the worst case is zero facts.
 */
export function extractFacts(text: string): ExtractionResult {
  const tokens = tokenize(text);
  const clauses = clauseRanges(tokens);
  const facts: ClinicalFact[] = [];
  const unparsed: Span[] = [];

  clauses.forEach((clause, sentenceIndex) => {
    const sites: ToothSite[] = [];
    let siteTokenFrom = -1;
    let siteTokenTo = -1;
    let procedure: { term: ProcedureTerm; from: number; to: number } | undefined;

    let i = clause.from;
    while (i < clause.to) {
      const group = readSiteGroup(tokens, i, clause.to);
      if (group) {
        sites.push(...group.sites);
        if (siteTokenFrom < 0) siteTokenFrom = group.tokenFrom;
        siteTokenTo = group.end;
        i = group.end;
        continue;
      }
      if (!procedure) {
        const proc = readProcedure(tokens, i, clause.to);
        if (proc) {
          procedure = proc;
          i = proc.to;
          continue;
        }
      }
      i++;
    }

    if (!procedure && sites.length === 0) {
      if (clause.to > clause.from) {
        unparsed.push({ start: tokens[clause.from].start, end: tokens[clause.to - 1].end });
      }
      return;
    }

    if (procedure) {
      const targetFrom = Math.min(procedure.from, siteTokenFrom < 0 ? procedure.from : siteTokenFrom);
      const targetTo = Math.max(procedure.to, siteTokenTo);
      const fact: ProcedureFact = {
        kind: "procedure",
        span: { start: tokens[targetFrom].start, end: tokens[targetTo - 1].end },
        assertion: assertionFor(tokens, clause, procedure.from, procedure.to),
        ruleId: procedure.term.id,
        sentenceIndex,
        procedure: procedure.term.display,
        category: procedure.term.category,
        sites
      };
      facts.push(fact);
      return;
    }

    // Teeth named with no procedure in the clause: still a fact — "caries #14"
    // and "#14 sensitive to cold" are both statements about tooth 14 — but the
    // clause did not say what was done, and we do not invent one.
    for (const site of sites) {
      const fact: ToothSiteFact = {
        kind: "tooth-site",
        span: site.span,
        assertion: assertionFor(tokens, clause, siteTokenFrom, siteTokenTo),
        ruleId: "site.bare",
        sentenceIndex,
        site
      };
      facts.push(fact);
    }
  });

  return { facts, unparsed, clauseCount: clauses.length };
}

/**
 * How much of this note did we actually understand?
 *
 * Reported to the user as a coverage figure and used by us as the growth
 * signal for the grammar. It is deliberately an honest denominator: clauses we
 * did not even try to parse count against us.
 */
export function coverage(result: ExtractionResult): number {
  if (result.clauseCount === 0) return 0;
  return (result.clauseCount - result.unparsed.length) / result.clauseCount;
}
