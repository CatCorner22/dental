// USA REGIONAL ENGLISH — colloquial phrases for enrollment scripts and
// recognition grammars. English only.
//
// PURPOSE: help the speech engine hear how people actually talk across
// regions, and give writers a read-only gloss when a colloquialism lands.
//
// HARD RULE: nothing in this file rewrites a transcript. Autocorrect and
// "fix" English substitution are forbidden — the speaker's words stay.
// Joins of split dental compounds live in normalize.ts and are the only
// allowed post-recognition text mutation.

export type UsaRegionId =
  | "northeast"
  | "south"
  | "midwest"
  | "southwest"
  | "west"
  | "general";

export interface UsaRegion {
  id: UsaRegionId;
  label: string;
  /** Short cue for the enrollment picker. */
  blurb: string;
}

export const USA_REGIONS: readonly UsaRegion[] = [
  {
    id: "general",
    label: "General U.S. English",
    blurb: "Nationwide everyday phrases — a good default."
  },
  {
    id: "northeast",
    label: "Northeast",
    blurb: "New England and Mid-Atlantic everyday speech."
  },
  {
    id: "south",
    label: "South",
    blurb: "Southern and Gulf Coast everyday speech."
  },
  {
    id: "midwest",
    label: "Midwest",
    blurb: "Great Lakes and Plains everyday speech."
  },
  {
    id: "southwest",
    label: "Southwest",
    blurb: "Southwest and borderland everyday speech."
  },
  {
    id: "west",
    label: "West Coast & Mountain West",
    blurb: "Pacific and mountain everyday speech."
  }
];

export interface ColloquialPhrase {
  /** Words the writer is asked to speak (and the grammar may boost). */
  say: string;
  /** Read-only gloss — never substituted into the transcript. */
  gloss: string;
  regions: readonly UsaRegionId[];
}

/**
 * Everyday U.S. colloquialisms that show up in patient-facing talk and
 * chairside chatter. Kept short so enrollment can cover many in 3–5 minutes.
 * Dental compounds stay in normalize.ts / the dental script list.
 */
export const REGIONAL_COLLOQUIALS: readonly ColloquialPhrase[] = [
  // General
  { say: "y'all", gloss: "you all (plural you)", regions: ["general", "south", "southwest"] },
  { say: "you guys", gloss: "informal plural you", regions: ["general", "northeast", "midwest", "west"] },
  { say: "gonna", gloss: "going to", regions: ["general"] },
  { say: "wanna", gloss: "want to", regions: ["general"] },
  { say: "kinda", gloss: "kind of", regions: ["general"] },
  { say: "sorta", gloss: "sort of", regions: ["general"] },
  { say: "yeah", gloss: "yes", regions: ["general"] },
  { say: "nope", gloss: "no", regions: ["general"] },
  { say: "hang on", gloss: "wait a moment", regions: ["general"] },
  { say: "hold up", gloss: "wait / pause", regions: ["general"] },
  { say: "for real", gloss: "truly / seriously", regions: ["general"] },
  { say: "no big deal", gloss: "not a serious problem", regions: ["general"] },
  { say: "all set", gloss: "ready / finished", regions: ["general", "northeast"] },
  { say: "sounds good", gloss: "agreement", regions: ["general"] },
  { say: "my bad", gloss: "that was my mistake", regions: ["general"] },
  { say: "hang tight", gloss: "please wait", regions: ["general"] },

  // Northeast
  { say: "wicked", gloss: "very / extremely (New England)", regions: ["northeast"] },
  { say: "youze", gloss: "plural you (some Mid-Atlantic)", regions: ["northeast"] },
  { say: "youse", gloss: "plural you (some Mid-Atlantic)", regions: ["northeast"] },
  { say: "mad", gloss: "angry or very (regional intensifier)", regions: ["northeast"] },
  { say: "hella", gloss: "very (also West)", regions: ["northeast", "west"] },
  { say: "jimmies", gloss: "ice-cream sprinkles (New England)", regions: ["northeast"] },
  { say: "soda", gloss: "soft drink", regions: ["northeast"] },
  { say: "the city", gloss: "often New York City by context", regions: ["northeast"] },
  { say: "down the shore", gloss: "to the beach (NJ/coastal)", regions: ["northeast"] },
  { say: "waved out", gloss: "exhausted / done", regions: ["northeast"] },

  // South
  { say: "fix", gloss: "yes (Southern)", regions: ["south"] },
  { say: "might could", gloss: "might be able to", regions: ["south"] },
  { say: "fix your business", gloss: "mind your own concerns", regions: ["south"] },
  { say: "bless your heart", gloss: "sympathy or soft rebuke (context-dependent)", regions: ["south"] },
  { say: "over yonder", gloss: "over there", regions: ["south"] },
  { say: "fix a spell", gloss: "wait a while", regions: ["south"] },
  { say: "coke", gloss: "any soft drink (some Southern usage)", regions: ["south"] },
  { say: "tump over", gloss: "tip over", regions: ["south"] },
  { say: "carry someone", gloss: "give someone a ride", regions: ["south"] },
  { say: "mash the button", gloss: "press the button", regions: ["south"] },

  // Midwest
  { say: "ope", gloss: "pardon me / oops", regions: ["midwest"] },
  { say: "you betcha", gloss: "yes / certainly", regions: ["midwest"] },
  { say: "pop", gloss: "soft drink", regions: ["midwest"] },
  { say: "hotdish", gloss: "casserole", regions: ["midwest"] },
  { say: "uff da", gloss: "expression of surprise or effort", regions: ["midwest"] },
  { say: "come with", gloss: "come along", regions: ["midwest"] },
  { say: "the lake", gloss: "often a specific local lake by context", regions: ["midwest"] },
  { say: "borrow me", gloss: "lend me (some dialects)", regions: ["midwest"] },
  { say: "sack", gloss: "bag (grocery)", regions: ["midwest"] },
  { say: "bubbler", gloss: "drinking fountain (WI and nearby)", regions: ["midwest"] },

  // Southwest
  { say: "howdy", gloss: "hello", regions: ["southwest", "south"] },
  { say: "fix fixin to", gloss: "about to", regions: ["southwest", "south"] },
  { say: "dry heat", gloss: "hot weather with low humidity", regions: ["southwest"] },
  { say: "the valley", gloss: "local valley metro by context", regions: ["southwest", "west"] },
  { say: "arroyo", gloss: "dry creek bed", regions: ["southwest"] },
  { say: "plaza", gloss: "town square / shopping area", regions: ["southwest"] },
  { say: "chile", gloss: "chili pepper (regional spelling spoken aloud)", regions: ["southwest"] },
  { say: "yonder", gloss: "over there", regions: ["southwest", "south"] },

  // West
  { say: "hella good", gloss: "very good", regions: ["west"] },
  { say: "the 5", gloss: "Interstate 5 (SoCal freeway naming)", regions: ["west"] },
  { say: "the 101", gloss: "Highway 101", regions: ["west"] },
  { say: "gnarly", gloss: "intense / impressive / rough", regions: ["west"] },
  { say: "stoked", gloss: "excited", regions: ["west"] },
  { say: "dude", gloss: "informal address", regions: ["west", "general"] },
  { say: "rad", gloss: "excellent", regions: ["west"] },
  { say: "bogus", gloss: "unfair / disappointing", regions: ["west"] },
  { say: "the bay", gloss: "San Francisco Bay Area by context", regions: ["west"] },
  { say: "June gloom", gloss: "cool cloudy early-summer weather (SoCal)", regions: ["west"] }
];

/** Dental / clinical spoken forms used in enrollment (English). */
export const DENTAL_ENROLLMENT_PHRASES: readonly string[] = [
  "bitewing radiographs were reviewed",
  "peri apical radiolucency noted",
  "local anesthetic administered",
  "no known drug allergies",
  "scaling and root planing completed",
  "post operative instructions given",
  "the patient tolerated the procedure well",
  "tooth number three mesial occlusal distal composite",
  "blood pressure one twenty over eighty",
  "nitrous oxide at thirty percent",
  "follow up in two weeks",
  "informed consent discussed and obtained",
  "gutta percha obturation completed",
  "sub gingival calculus removed",
  "supra gingival polish completed"
];

export function phrasesForRegion(region: UsaRegionId): ColloquialPhrase[] {
  return REGIONAL_COLLOQUIALS.filter(
    (p) => p.regions.includes(region) || p.regions.includes("general")
  );
}

/**
 * Build the spoken prompt list for a 3–5 minute enrollment session.
 * Regional colloquialisms first, then dental forms — coverage over novelty.
 */
export function enrollmentScript(region: UsaRegionId): string[] {
  const colloquial = phrasesForRegion(region).map((p) => p.say);
  // Dedupe while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...colloquial, ...DENTAL_ENROLLMENT_PHRASES]) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function isUsaRegionId(v: unknown): v is UsaRegionId {
  return typeof v === "string" && USA_REGIONS.some((r) => r.id === v);
}
