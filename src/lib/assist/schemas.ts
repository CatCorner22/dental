// Output contracts for the two capabilities that return a LIST rather than a
// note.
//
// `interrogate` and `conflicts` used to come back as prose, and the UI split it
// on newlines. That is the brittle-extraction anti-pattern: a model that opens
// with "Here are the questions:" silently becomes a first bullet, a wrapped line
// becomes two items, and an empty answer is indistinguishable from a refusal.
// A schema makes the shape the model's problem instead of the parser's.
//
// Raw JSON Schema rather than Zod, deliberately. Zod is present only as a
// transitive dependency of the `ai` package, and building a safety contract on
// something nothing in this repo declares is how a build breaks on an unrelated
// upgrade. JSON Schema is also the interoperability layer the providers
// actually speak.
//
// Kept SMALL on purpose: shallow, few properties, no nesting beyond one level.
// Complex schemas confuse models, and a confused model produces valid shapes
// full of nonsense — which the validators below are the second line against.

export const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      maxItems: 12,
      items: {
        type: "string",
        description:
          "One question about a fact the note leaves open. Must be a question, never an assertion."
      }
    }
  }
} as const;

export const CONFLICTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conflicts"],
  properties: {
    conflicts: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["first", "second", "why"],
        properties: {
          first: { type: "string", description: "The first statement, quoted from the note." },
          second: { type: "string", description: "The second statement, quoted from the note." },
          why: { type: "string", description: "Why the two cannot both be true, in one sentence." }
        }
      }
    }
  }
} as const;

export interface Conflict {
  first: string;
  second: string;
  why: string;
}

export type ListValidation<T> = { ok: true; items: T[] } | { ok: false; reason: string };

const MAX_ITEM = 400;

function cleanStrings(value: unknown, field: string): ListValidation<string> {
  if (!value || typeof value !== "object") return { ok: false, reason: "not an object" };
  const raw = (value as Record<string, unknown>)[field];
  if (!Array.isArray(raw)) return { ok: false, reason: `${field} is not an array` };
  const items: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") return { ok: false, reason: `${field} contains a non-string` };
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_ITEM) return { ok: false, reason: `${field} entry is too long` };
    if (!items.includes(trimmed)) items.push(trimmed);
  }
  return { ok: true, items };
}

/**
 * Validate the questions payload independently of the provider.
 *
 * Schema-constrained decoding guarantees SHAPE. It cannot guarantee that the
 * strings are questions — and a "question" that actually asserts is precisely
 * the failure `verifyMeaning`'s `not-questions` code exists for. Checking it
 * here catches it one layer earlier, with a reason the user can read.
 */
export function validateQuestions(value: unknown): ListValidation<string> {
  const cleaned = cleanStrings(value, "questions");
  if (!cleaned.ok) return cleaned;
  const asserting = cleaned.items.filter((q) => !q.endsWith("?"));
  if (asserting.length > 0) {
    return {
      ok: false,
      reason: `${asserting.length} entr${asserting.length === 1 ? "y is" : "ies are"} not a question`
    };
  }
  return cleaned;
}

/** Validate the conflicts payload. Both sides must be present and different. */
export function validateConflicts(value: unknown): ListValidation<Conflict> {
  if (!value || typeof value !== "object") return { ok: false, reason: "not an object" };
  const raw = (value as Record<string, unknown>).conflicts;
  if (!Array.isArray(raw)) return { ok: false, reason: "conflicts is not an array" };
  const items: Conflict[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return { ok: false, reason: "conflict is not an object" };
    const row = entry as Record<string, unknown>;
    const first = typeof row.first === "string" ? row.first.trim() : "";
    const second = typeof row.second === "string" ? row.second.trim() : "";
    const why = typeof row.why === "string" ? row.why.trim() : "";
    if (!first || !second || !why) return { ok: false, reason: "a conflict is missing a side" };
    if (first.length > MAX_ITEM || second.length > MAX_ITEM || why.length > MAX_ITEM) {
      return { ok: false, reason: "a conflict entry is too long" };
    }
    // A "conflict" between a statement and itself is the model filling the
    // array to look useful. It is not a contradiction and must not be shown as
    // one — a clinician would go looking for a problem that is not there.
    if (first.toLowerCase() === second.toLowerCase()) {
      return { ok: false, reason: "a conflict names the same statement twice" };
    }
    items.push({ first, second, why });
  }
  return { ok: true, items };
}

/** One line per item, for the verifier and for anything that wants plain text. */
export function conflictsToLines(items: Conflict[]): string[] {
  return items.map((c) => `"${c.first}" vs "${c.second}" — ${c.why}`);
}
