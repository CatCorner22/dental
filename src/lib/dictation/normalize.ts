// DICTATION NORMALIZATION — deterministic repair of terms speech engines split.
//
// Generic speech-to-text reliably breaks dental compounds apart ("bite wing",
// "peri apical", "x ray") because its language model was not trained on
// operatory speech — the research digest (voice-to-text landscape) documents
// generic STT mis-transcribing a large share of dental terminology without a
// domain layer. This is that layer, sized to the truth: a small table of
// JOINS, nothing else.
//
// The contract mirrors the main transformer's invariant: this pass may only
// reassemble a term the speaker already said. It never expands shorthand,
// never adds or changes a word, never touches numbers, doses, teeth, or
// negations. Joins use [ \t]+ (never \s+) so a line break or sentence
// punctuation is always a boundary — "seated post. Op note follows" is two
// sentences, not a split "post-op".
//
// Everything it produces still lands in the input box, in front of the
// writer, and faces the full standardize pass + resolution queue like any
// typed text. This is entry assistance, not note transformation.

interface JoinRule {
  pattern: RegExp;
  /** "$1$2" fuses; "$1-$2" hyphenates. Casing comes from the captures. */
  replacement: string;
}

const JOIN_RULES: readonly JoinRule[] = [
  { pattern: /\b(bite)[ \t]+(wings?)\b/gi, replacement: "$1$2" },
  { pattern: /\b(peri)[ \t]+(apicals?)\b/gi, replacement: "$1$2" },
  { pattern: /\b(x)[ \t]+(rays?)\b/gi, replacement: "$1-$2" },
  { pattern: /\b(sub)[ \t]+(gingival)\b/gi, replacement: "$1$2" },
  { pattern: /\b(supra)[ \t]+(gingival)\b/gi, replacement: "$1$2" },
  { pattern: /\b(inter)[ \t]+(proximal)\b/gi, replacement: "$1$2" },
  { pattern: /\b(gutta)[ \t]+(percha)\b/gi, replacement: "$1-$2" },
  // "post operative" before "post op": the longer form must win the match.
  { pattern: /\b(post)[ \t]+(operative(?:ly)?)\b/gi, replacement: "$1$2" },
  { pattern: /\b(pre)[ \t]+(operative(?:ly)?)\b/gi, replacement: "$1$2" },
  { pattern: /\b(post)[ \t]+(op)\b/gi, replacement: "$1-$2" },
  { pattern: /\b(pre)[ \t]+(op)\b/gi, replacement: "$1-$2" }
];

export interface DictationChange {
  from: string;
  to: string;
}

export interface DictationNormalization {
  text: string;
  changes: DictationChange[];
}

export function normalizeDictation(input: string): DictationNormalization {
  let text = input;
  const changes: DictationChange[] = [];
  for (const rule of JOIN_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    text = text.replace(re, (match, a: string, b: string) => {
      const joined = rule.replacement === "$1-$2" ? `${a}-${b}` : `${a}${b}`;
      changes.push({ from: match, to: joined });
      return joined;
    });
  }
  return { text, changes };
}
