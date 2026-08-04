// EVIDENCE-PINNED EXTRACTION — the model points, the verifier checks, a human decides.
//
// ===========================================================================
// THE ACCEPTANCE TEST, adopted verbatim from the owner's blueprint:
//
//   "No AI-generated clinical fact can be finalized without visible source
//    evidence or affirmative clinician confirmation."
//
// This module is how that sentence becomes machinery. The model's job is
// deliberately small: it does not write the note, it does not fill fields, it
// PROPOSES facts — and every proposal must carry a VERBATIM QUOTE of the source
// text that supports it. Pointing is checkable in a way prose is not: the quote
// either exists in the input or it does not, and the fact is either grounded in
// the quote or it is not. Both checks are deterministic, so a fabricated fact
// is refused by arithmetic before any human spends attention on it.
//
// WHY THIS BEATS THE INCUMBENT'S SHAPE. Curve Care+ generates SOAP prose and
// asks users to please re-read it carefully — trust enforced by attention.
// Here the reviewing clinician clicks a fact and sees the exact words it came
// from, and anything that could not show its words never reached the screen.
//
// WHAT THE VERIFIER DELIBERATELY DOES NOT DO: judge clinical correctness. A
// grounded, quote-supported fact can still be clinically wrong (the writer's
// own text can be wrong), and only the person in the room can know. The
// verifier's contract is narrower and absolute: nothing unsupported by the
// writer's own words gets through.
// ===========================================================================

import { foldDigits } from "@/lib/text/foldDigits";
import { checkGrounding } from "@/lib/verify/grounding";
import { extractFacts } from "@/lib/extract/extract";
import { assertionFor } from "@/lib/extract/context";
import { clauseRanges, tokenize } from "@/lib/extract/tokenize";

/** The kinds the model may propose — the deterministic parser's own taxonomy. */
export const EXTRACTABLE_KINDS = [
  "tooth-site",
  "procedure",
  "medication",
  "measurement",
  "finding",
  "material",
  "care-event"
] as const;
export type ExtractableKind = (typeof EXTRACTABLE_KINDS)[number];

export interface ProposedFact {
  kind: ExtractableKind;
  /** The fact in standard words. */
  statement: string;
  /** VERBATIM text from the input that supports it. The whole contract. */
  quote: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Kept shallow per the schema philosophy in schemas.ts: complex schemas
 * confuse models, and a confused model produces valid shapes full of nonsense.
 * The verifier below is the second line against exactly that.
 */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "statement", "quote", "confidence"],
        properties: {
          kind: { type: "string", enum: [...EXTRACTABLE_KINDS] },
          statement: {
            type: "string",
            description: "The clinical fact in standard words. No new numbers, drugs, teeth, or negations."
          },
          quote: {
            type: "string",
            description:
              "The EXACT text from the note that states this fact, copied verbatim. Never paraphrase."
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        }
      }
    }
  }
} as const;

export function validateExtraction(
  value: unknown
): { ok: true; facts: ProposedFact[] } | { ok: false; reason: string } {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "not an object" };
  const facts = (value as { facts?: unknown }).facts;
  if (!Array.isArray(facts)) return { ok: false, reason: "facts is not an array" };
  if (facts.length > 20) return { ok: false, reason: "too many facts" };
  const out: ProposedFact[] = [];
  for (const f of facts) {
    if (typeof f !== "object" || f === null) return { ok: false, reason: "fact is not an object" };
    const { kind, statement, quote, confidence } = f as Record<string, unknown>;
    if (!EXTRACTABLE_KINDS.includes(kind as ExtractableKind))
      return { ok: false, reason: "unknown fact kind" };
    if (typeof statement !== "string" || !statement.trim() || statement.length > 300)
      return { ok: false, reason: "bad statement" };
    if (typeof quote !== "string" || !quote.trim() || quote.length > 500)
      return { ok: false, reason: "bad quote" };
    if (confidence !== "high" && confidence !== "medium" && confidence !== "low")
      return { ok: false, reason: "bad confidence" };
    out.push({
      kind: kind as ExtractableKind,
      statement: statement.trim(),
      quote: quote.trim(),
      confidence
    });
  }
  return { ok: true, facts: out };
}

export interface PinnedFact {
  kind: ExtractableKind;
  statement: string;
  quote: string;
  /** Character offsets of the quote in the ORIGINAL input. The visible evidence. */
  start: number;
  end: number;
  confidence: "high" | "medium";
  /**
   * True when the deterministic parser independently read a fact of this kind
   * inside the quoted span. The genuinely independent second reader: it shares
   * no weights and no biases with any model, so its agreement means something.
   */
  parserAgrees: boolean;
}

export type RefusalCode =
  | "extract.quote-not-found"
  | "extract.ungrounded"
  | "extract.invented-number"
  | "extract.polarity-conflict";

export interface RefusedFact {
  code: RefusalCode;
  kind: ExtractableKind;
  /** Shown to the reviewing user. Never logged — codes are what the drift row gets. */
  statement: string;
  reason: string;
}

export interface VerifiedExtraction {
  pinned: PinnedFact[];
  /** Low-confidence proposals, demoted to questions a human must answer. */
  questions: string[];
  refused: RefusedFact[];
}

/**
 * Locate a quote in the input, tolerating only whitespace differences.
 *
 * Whitespace-insensitive because a model that reads "2 carp  lido" will
 * reasonably quote it as "2 carp lido", and refusing over a double space would
 * teach users the checker is pedantic rather than protective. EVERYTHING ELSE
 * must match exactly — a quote with corrected spelling or expanded shorthand is
 * a paraphrase, and a paraphrase is not evidence.
 */
export function locateQuote(input: string, quote: string): { start: number; end: number } | null {
  if (!quote.trim()) return null;
  const direct = input.indexOf(quote);
  if (direct >= 0) return { start: direct, end: direct + quote.length };

  const pattern = quote
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  if (!pattern) return null;
  const m = new RegExp(pattern).exec(input);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

const digitRuns = (text: string): string[] => foldDigits(text).match(/\d+/g) ?? [];

/**
 * The verifier. Pure, deterministic, and refusal-first.
 *
 * Order of checks per fact, cheapest and most decisive first:
 *   1. The quote must exist verbatim in the input.
 *   2. Every number in the statement must appear in the quote — a dose, tooth,
 *      or ratio the quote does not contain is an invented number, full stop.
 *   3. The statement must be lexically grounded in the quote, through the same
 *      two-tier machinery the meaning verifier uses (input words + licensed
 *      vocabulary expansions, so "lido" in the quote grounds "lidocaine").
 *   4. The quote's own negation, read by the deterministic ConText layer, must
 *      not contradict the statement — "no swelling" cannot pin "swelling".
 *   5. Low confidence never becomes a fact; it becomes a question.
 */
export function verifyExtraction(input: string, proposed: ProposedFact[]): VerifiedExtraction {
  const pinned: PinnedFact[] = [];
  const questions: string[] = [];
  const refused: RefusedFact[] = [];

  // The parser's own reading of the whole input, once, for agreement checks.
  const parserFacts = extractFacts(input).facts;

  for (const fact of proposed) {
    const where = locateQuote(input, fact.quote);
    if (!where) {
      refused.push({
        code: "extract.quote-not-found",
        kind: fact.kind,
        statement: fact.statement,
        reason: "The supporting quote does not appear in your text. Evidence must be verbatim."
      });
      continue;
    }
    const quoteInInput = input.slice(where.start, where.end);

    const quoteDigits = new Set(digitRuns(quoteInInput));
    const missingNumber = digitRuns(fact.statement).find((d) => !quoteDigits.has(d));
    if (missingNumber !== undefined) {
      refused.push({
        code: "extract.invented-number",
        kind: fact.kind,
        statement: fact.statement,
        reason: `The number ${missingNumber} is not in the quoted text. Numbers are never inferred.`
      });
      continue;
    }

    const grounding = checkGrounding(quoteInInput, fact.statement);
    if (grounding.fabricatedAssertions.length > 0 || grounding.inventedClauses.length > 0) {
      refused.push({
        code: "extract.ungrounded",
        kind: fact.kind,
        statement: fact.statement,
        reason:
          "The statement says more than the quoted text supports" +
          (grounding.fabricatedAssertions.length
            ? ` (${grounding.fabricatedAssertions.join(", ")})`
            : "") +
          "."
      });
      continue;
    }

    if (quoteNegatesStatement(quoteInInput, fact.statement)) {
      refused.push({
        code: "extract.polarity-conflict",
        kind: fact.kind,
        statement: fact.statement,
        reason: "The quoted text DENIES this. A negation is a fact about absence, not presence."
      });
      continue;
    }

    if (fact.confidence === "low") {
      questions.push(
        `The note may state: "${fact.statement}" (from "${quoteInInput}"). Confirm or correct this rather than assuming it.`
      );
      continue;
    }

    pinned.push({
      kind: fact.kind,
      statement: fact.statement,
      quote: quoteInInput,
      start: where.start,
      end: where.end,
      confidence: fact.confidence,
      parserAgrees: parserFacts.some(
        (p) => p.kind === fact.kind && p.span.start < where.end && p.span.end > where.start
      )
    });
  }

  return { pinned, questions, refused };
}

/**
 * Does the quote deny what the statement asserts?
 *
 * Read by the same deterministic ConText layer the extractor uses, targeted at
 * the statement's first clinical token as it appears in the quote. Narrow on
 * purpose: this check exists to stop "no caries" pinning "caries", not to
 * re-litigate every hedge. A statement that itself carries the negation
 * ("no caries observed") agrees with its quote and passes.
 */
function quoteNegatesStatement(quote: string, statement: string): boolean {
  const quoteTokens = tokenize(quote);
  const clauses = clauseRanges(quoteTokens);
  const statementLower = new Set(tokenize(statement).map((t) => t.lower));

  for (const clause of clauses) {
    for (let i = clause.from; i < clause.to; i++) {
      const token = quoteTokens[i];
      if (token.kind !== "word") continue;
      if (!statementLower.has(token.lower)) continue;
      const inQuote = assertionFor(quoteTokens, clause, i, i + 1);
      if (inQuote.polarity !== "negated") continue;
      // The quote denies this token. Does the statement deny it too? If the
      // statement is also negated on the same token, they agree.
      const statementTokens = tokenize(statement);
      const statementClauses = clauseRanges(statementTokens);
      const j = statementTokens.findIndex((t) => t.lower === token.lower);
      if (j < 0) continue;
      const sClause = statementClauses.find((c) => j >= c.from && j < c.to);
      if (!sClause) continue;
      const inStatement = assertionFor(statementTokens, sClause, j, j + 1);
      if (inStatement.polarity !== "negated") return true;
    }
  }
  return false;
}
