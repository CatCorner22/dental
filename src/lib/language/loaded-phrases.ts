// LOADED-PHRASE CATALOG — the practice's language-vigilance standard, applied
// to the application's OWN voice.
//
// Derived from the practice's language and cultural-sensitivity guidance
// (.cursor/skills/chicken-little-college-kid): phrases that modern inclusive-
// language guides flag as historical, ableist, gendered, or appropriative.
// The screen covers what the APP says to staff — advisor copy, coaching text,
// gauge notes — not what staff write in notes. Clinical terms of art are
// exempt by construction ("master apical file" is the endodontic term and
// stays; the catalog matches the master/slave PAIRING, not the word alone).
//
// This is calm enforcement, not policing: nothing here judges a human's
// wording. It keeps the tool's own mouth to the standard the tool teaches —
// the same reason Byte's knowledge base runs through the blocking audit.

export interface LoadedPhrase {
  id: string;
  pattern: RegExp;
  /** Why some readers flag it — one line, no lecture. */
  why: string;
  /** Practical alternatives, ready to paste. */
  alternatives: string[];
}

export const LOADED_PHRASES: readonly LoadedPhrase[] = [
  {
    id: "grandfathered",
    pattern: /\bgrandfather(?:ed|ing)?\s+(?:in|clause)|\bgrandfathered\b/i,
    why: "Historical origin in discriminatory post-Civil War voting laws.",
    alternatives: ["legacy status", "pre-existing exemption", "previously approved"]
  },
  {
    id: "blacklist-whitelist",
    pattern: /\b(?:black|white)list(?:ed|ing|s)?\b/i,
    why: "Color-coded good/bad associations; clearer alternatives exist.",
    alternatives: ["blocklist / denylist", "allowlist / permit list"]
  },
  {
    id: "master-slave-pair",
    // The PAIRING is the flag; standalone "master" (master apical file,
    // master's degree) is ordinary usage and clinical vocabulary.
    pattern: /\bmaster\b[^.\n]{0,40}\bslave\b|\bslave\b[^.\n]{0,40}\bmaster\b/i,
    why: "Slavery connotations in the paired technical metaphor.",
    alternatives: ["primary / replica", "leader / follower", "controller / worker"]
  },
  {
    id: "mental-state-slang",
    pattern: /\b(?:crazy|insane|psycho|lunatic)\b/i,
    why: "Casual mental-health slang reads as ableist in clinical materials.",
    alternatives: ["unexpected", "intense", "unusual"]
  },
  {
    id: "ableist-put-downs",
    pattern: /\b(?:lame|retarded)\b/i,
    why: "Ableist origin; always a clearer word available.",
    alternatives: ["uncool", "outdated", "delayed"]
  },
  {
    id: "sensory-metaphors",
    pattern: /\b(?:blind|deaf)\s+to\b/i,
    why: "Ableist sensory metaphor; the literal phrase is clearer anyway.",
    alternatives: ["unaware of", "overlooking", "could not see"]
  },
  {
    id: "ethnic-slur-verbs",
    pattern: /\bgypped\b|\bjewed\b/i,
    why: "Ethnic-slur origins.",
    alternatives: ["shortchanged", "overcharged", "negotiated down"]
  },
  {
    id: "indigenous-appropriation",
    pattern: /\bspirit animal\b|\bpowwow\b|\btribe\b/i,
    why: "Appropriates Indigenous concepts in casual use.",
    alternatives: ["inspiration", "huddle", "team"]
  },
  {
    id: "segregation-era",
    pattern: /\bpeanut gallery\b|\bsold down the river\b|\bblackball(?:ed|ing)?\b/i,
    why: "Segregation- or slavery-era history.",
    alternatives: ["observers", "betrayed", "excluded"]
  },
  {
    id: "gendered-defaults",
    pattern: /\bmanpower\b|\bman-hours\b|\bhe or she\b|\bhis or her\b/i,
    why: "Gendered default where neutral phrasing is available.",
    alternatives: ["staff time", "person-hours", "the patient / they / their"]
  },
  {
    id: "pidgin-mockery",
    pattern: /\bno can do\b|\blong time no see\b/i,
    why: "Pidgin-English origins some readers hear as mocking.",
    alternatives: ["that will not work", "it has been a while"]
  }
] as const;

/** Screen one string; returns the ids of every catalog entry it trips. */
export function screenLoadedPhrases(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const entry of LOADED_PHRASES) {
    if (entry.pattern.test(text)) hits.push(entry.id);
  }
  return hits;
}
