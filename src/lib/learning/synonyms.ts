// DENTAL SYNONYM GROUPS — retrieval-side only for the learning ledger.
//
// Merges true clinical synonyms that bigram similarity still splits
// ("post-op instr" vs "postoperative instructions"). Never writes chart
// claims. Keep groups small and dental-operatory-specific; do not fold
// ambiguous abbreviations that mean different things in different notes.
//
// Local normalize matches cluster.normalizeSubject — kept separate to avoid
// a circular import (cluster → synonyms → cluster).

function norm(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Each inner array is one synonym family; the first entry is the display key. */
export const DENTAL_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["postop", "post-op", "postoperative", "post op", "postoperativecare"],
  ["preop", "pre-op", "preoperative", "pre op"],
  [
    "postopinstructions",
    "postopinstr",
    "post-op instr",
    "post-op instructions",
    "postoperative instructions",
    "post op instructions"
  ],
  ["bitewing", "bitewings", "bwx", "bitewingradiograph", "bitewingxray"],
  ["periapical", "periapicalradiograph", "periapicalxray"],
  ["panoramic", "pano", "panorex", "panoradiograph"],
  ["prophylaxis", "prophy", "adultprophy", "childprophy"],
  ["scalingrootplaning", "srp", "scalingandrootplaning"],
  ["rootcanal", "rootcanaltherapy", "endodontictreatment"],
  ["nitrousoxide", "n2o", "nitrous", "laughinggas"],
  ["localanesthetic", "localanesthesia", "lidocaine", "articaine"],
  ["temporarycrown", "tempcrown", "provisionalcrown"],
  ["oralhygieneinstructions", "ohi", "hygieneinstructions"],
  ["followup", "f/u", "follow-up", "follow up"],
  ["informedconsent", "consentobtained", "informedconsentobtained"]
];

const KEY_BY_NORM: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const group of DENTAL_SYNONYM_GROUPS) {
    const key = norm(group[0]!);
    for (const member of group) {
      m.set(norm(member), key);
    }
  }
  return m;
})();

/**
 * Canonical synonym key for a token, if it belongs to a dental synonym
 * family. Undefined means "no synonym map entry — use bigram/normalize only."
 */
export function synonymKey(token: string): string | undefined {
  return KEY_BY_NORM.get(norm(token));
}

/** True when two surfaces are listed as the same clinical synonym. */
export function areDentalSynonyms(a: string, b: string): boolean {
  const ka = synonymKey(a);
  const kb = synonymKey(b);
  return !!ka && !!kb && ka === kb;
}
