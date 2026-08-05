// READ-ONLY COMPREHENSION GLOSSES — never mutate the transcript.
//
// When a regional colloquialism appears in recognized text, we may show what
// it commonly means. We never replace, "correct", or autocorrect the words.

import { REGIONAL_COLLOQUIALS, type ColloquialPhrase, type UsaRegionId } from "./regional";

export interface GlossHit {
  phrase: string;
  gloss: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find colloquial phrases present in `text` for optional UI chips.
 * Matching is case-insensitive; output never rewrites `text`.
 */
export function glossColloquialisms(
  text: string,
  region: UsaRegionId = "general"
): GlossHit[] {
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  const candidates = REGIONAL_COLLOQUIALS.filter(
    (p) => p.regions.includes(region) || p.regions.includes("general")
  );
  // Longer phrases first so "hella good" wins over "hella".
  const sorted = [...candidates].sort((a, b) => b.say.length - a.say.length);
  const hits: GlossHit[] = [];
  const claimed = new Set<string>();
  for (const p of sorted) {
    const re = new RegExp(`\\b${escapeRe(p.say)}\\b`, "i");
    if (!re.test(lower)) continue;
    const key = p.say.toLowerCase();
    if (claimed.has(key)) continue;
    claimed.add(key);
    hits.push({ phrase: p.say, gloss: p.gloss });
  }
  return hits;
}

/** Grammar / enrollment helpers — phrase list only. */
export function colloquialSayings(region: UsaRegionId): string[] {
  return REGIONAL_COLLOQUIALS.filter(
    (p: ColloquialPhrase) => p.regions.includes(region) || p.regions.includes("general")
  ).map((p) => p.say);
}
