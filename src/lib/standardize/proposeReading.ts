// AMBIGUITY PROPOSALS — suggest a reading; never write it into the note.
//
// The transformer refuses to expand ambiguous shorthand. That is correct.
// Friction drops when the tool proposes the most likely reading from
// surrounding cues, and the writer still has to type the words they mean.
//
// A proposal is advice. Wrong proposals that staff decline are the same worst
// case as today's always-ask prompt. Auto-apply is forbidden.

export interface ReadingProposal {
  /** Suggested expansion / wording, from the table's alternatives. */
  suggested: string;
  /** One-line why this reading fits the surrounding text. */
  rationale: string;
  /** Heuristic strength 0..1 — never shown as a "confidence %" in the UI. */
  strength: number;
}

interface AltCues {
  /** Matches one alternative (or distinctive words in it). */
  alt: RegExp;
  cues: RegExp[];
}

/** Per-display-family cue sets. Kept small and dental-operatory-specific. */
const FAMILIES: Array<{ displays: RegExp; alts: AltCues[] }> = [
  {
    displays: /^CR$/i,
    alts: [
      { alt: /composite resin/i, cues: [/\b(?:MOD|MO|DO|filling|restor|etch|bond|shade|composite)\b/i] },
      { alt: /centric relation/i, cues: [/\b(?:occlusion|bite|MIP|jaw|articulat|centric)\b/i] }
    ]
  },
  {
    displays: /^GP$/i,
    alts: [
      { alt: /gutta-percha/i, cues: [/\b(?:RCT|root canal|obtura|canal|endo|sealer)\b/i] },
      { alt: /general practitioner/i, cues: [/\b(?:referral|referred|physician|medical)\b/i] }
    ]
  },
  {
    displays: /^GI$/i,
    alts: [
      { alt: /glass ionomer/i, cues: [/\b(?:cement|liner|restor|filling|base|Fuji)\b/i] },
      { alt: /gastrointestinal/i, cues: [/\b(?:stomach|nausea|GERD|digest|upset)\b/i] }
    ]
  },
  {
    displays: /^EXT$/i,
    alts: [
      { alt: /^extraction$/i, cues: [/\b(?:forceps|socket|hemostasis|extracted|#\d|tooth\s*\d)\b/i] },
      { alt: /^extension$/i, cues: [/\b(?:temp|temporary|margin|bridge|pontic)\b/i] }
    ]
  },
  {
    displays: /^(?:FMS|FMX)$/i,
    alts: [
      { alt: /full-mouth radiographic/i, cues: [/\b(?:radiograph|x-?ray|pano|BW|PA|series)\b/i] },
      { alt: /fibromyalgia/i, cues: [/\b(?:chronic|joint|muscle|fibro|pain syndrome)\b/i] }
    ]
  },
  {
    displays: /^NKA$/i,
    alts: [
      { alt: /no known drug allergies/i, cues: [/\b(?:drug|medication|NKDA|penicillin|latex)\b/i] },
      { alt: /no known allergies/i, cues: [/\b(?:allerg)\b/i] }
    ]
  },
  {
    displays: /^LA$/i,
    alts: [
      { alt: /local anesth/i, cues: [/\b(?:lido|articaine|carpule|infiltrat|block|mg|mL)\b/i] }
    ]
  },
  {
    displays: /^CC$/i,
    alts: [
      { alt: /chief complaint/i, cues: [/\b(?:presents|c\/o|pain|complaint|CC:)\b/i] },
      { alt: /cubic centimetres|mL/i, cues: [/\b(?:mL|cc of|volume)\b/i] }
    ]
  },
  {
    displays: /^CAL$/i,
    alts: [
      { alt: /clinical attachment/i, cues: [/\b(?:probing|periodont|mm|attachment)\b/i] },
      { alt: /calcium/i, cues: [/\b(?:supplement|serum|lab)\b/i] }
    ]
  },
  {
    displays: /^PSA$/i,
    alts: [
      { alt: /posterior superior alveolar/i, cues: [/\b(?:block|anesthet|maxillary|molar)\b/i] },
      { alt: /prostate-specific/i, cues: [/\b(?:lab|ng\/mL|prostate|PSA level)\b/i] }
    ]
  }
];

/**
 * Propose the best-fitting alternative for an ambiguous display token,
 * using only surrounding note text. Returns undefined when cues do not
 * clearly favor one reading (safer to ask without a hint).
 */
export function proposeReading(
  display: string,
  alternatives: string[],
  surroundingText: string
): ReadingProposal | undefined {
  if (alternatives.length < 2) return undefined;
  const family = FAMILIES.find((f) => f.displays.test(display));
  const scores = alternatives.map((alt) => {
    let score = 0;
    if (family) {
      for (const row of family.alts) {
        if (!row.alt.test(alt)) continue;
        for (const cue of row.cues) {
          if (cue.test(surroundingText)) score += 0.45;
        }
      }
    } else {
      // Generic fallback: distinctive words from the alternative appear nearby.
      const words = alt
        .replace(/\([^)]*\)/g, "")
        .split(/[^a-zA-Z]+/)
        .filter((w) => w.length > 4);
      for (const w of words) {
        if (new RegExp(`\\b${w}\\b`, "i").test(surroundingText)) score += 0.2;
      }
    }
    return { alt, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  if (!best || best.score < 0.4) return undefined;
  if (second && best.score - second.score < 0.15) return undefined;

  return {
    suggested: best.alt,
    rationale: `Nearby wording fits "${best.alt}" better than the other listed meanings. Write that out if it is what you mean — do not leave the shorthand.`,
    strength: Math.min(1, best.score)
  };
}
