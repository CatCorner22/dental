// Structured ByteStar output. Suggestions are advice; optional `rewrite` is a
// single-sentence proposal that must still pass verifyMeaning before a human
// sees it. Completeness items use `question` and never carry a rewrite.
//
// Raw JSON Schema, matching the assist layer: Zod is not a direct dependency.

export const BYTESTAR_SUGGESTION_KINDS = [
  "active-voice",
  "standardize",
  "tn-required",
  "clarity",
  "completeness"
] as const;

export type ByteStarSuggestionKind = (typeof BYTESTAR_SUGGESTION_KINDS)[number];

export interface ByteStarSuggestion {
  kind: ByteStarSuggestionKind;
  say: string;
  why: string;
  evidence?: string;
  rewrite?: string;
  question?: string;
  source: string;
}

export interface ByteStarResponse {
  suggestions: ByteStarSuggestion[];
}

export const BYTESTAR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "say", "why", "source"],
        properties: {
          kind: { type: "string", enum: [...BYTESTAR_SUGGESTION_KINDS] },
          say: { type: "string" },
          why: { type: "string" },
          evidence: { type: "string" },
          rewrite: { type: "string" },
          question: { type: "string" },
          source: { type: "string" }
        }
      }
    }
  }
} as const;

function isKind(v: unknown): v is ByteStarSuggestionKind {
  return typeof v === "string" && (BYTESTAR_SUGGESTION_KINDS as readonly string[]).includes(v);
}

function asTrimmed(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

export function validateByteStarResponse(raw: unknown): ByteStarResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const suggestions = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions) || suggestions.length > 3) return null;
  const out: ByteStarSuggestion[] = [];
  for (const item of suggestions) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (!isKind(o.kind)) return null;
    const say = asTrimmed(o.say, 400);
    const why = asTrimmed(o.why, 600);
    const source = asTrimmed(o.source, 200);
    if (!say || !why || !source || source.length < 3) return null;
    const suggestion: ByteStarSuggestion = { kind: o.kind, say, why, source };
    const evidence = o.evidence === undefined ? undefined : asTrimmed(o.evidence, 300);
    const rewrite = o.rewrite === undefined ? undefined : asTrimmed(o.rewrite, 500);
    const question = o.question === undefined ? undefined : asTrimmed(o.question, 300);
    if (o.evidence !== undefined && !evidence) return null;
    if (o.rewrite !== undefined && !rewrite) return null;
    if (o.question !== undefined && !question) return null;
    if (evidence) suggestion.evidence = evidence;
    if (rewrite) suggestion.rewrite = rewrite;
    if (question) suggestion.question = question;
    out.push(suggestion);
  }
  return { suggestions: out };
}
