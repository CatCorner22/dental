// Dental and medical shorthand, initialisms, and acronyms.
//
// THE CONVENTION THIS TABLE EXISTS TO ENFORCE: a term of art is written out in
// full the FIRST time it appears, with the shorthand in parentheses after it,
// and the shorthand alone thereafter.
//
//     "Root canal therapy (RCT) was started. The RCT was completed at the
//      second visit."
//
// That is how a note stays readable to someone who was not in the operatory —
// an insurer, a specialist, an attorney, a colleague covering a shift — without
// forcing the writer to spell out the same phrase six times. It is the standard
// convention in medical and legal writing, and it is what makes a note survive
// being read years later by someone who does not share your habits.
//
// AMBIGUOUS ENTRIES ARE NEVER EXPANDED. Several of these initialisms mean more
// than one real thing in a dental chart: GP is gutta-percha and general
// practitioner; CR is composite resin and centric relation; ASA is a nerve
// block and an anesthesia risk classification. Guessing would put a clinical
// claim in the note that the writer never made, so those carry `alternatives`
// and are surfaced for the writer to resolve.
//
// DOSING FREQUENCIES follow the ISMP error-prone abbreviation list. The ones
// with a single unambiguous reading are expanded; "qd" and "qod" are NOT,
// because they are confused with each other and with "qid" in real handwriting
// and that confusion has caused real dosing errors.

export interface Shorthand {
  id: string;
  /** Matches the shorthand as written. Must carry the g flag. */
  pattern: RegExp;
  /** Canonical form shown in parentheses and in the word map. */
  display: string;
  /** The full term of art. */
  expansion: string;
  /** Present when the shorthand has more than one real reading in a dental chart. */
  alternatives?: string[];
  domain: "dental" | "medical" | "dosing";
}

export const SHORTHAND: Shorthand[] = [
  // ---- Radiographs and imaging
  { id: "bw", pattern: /\bBWX?s?\b/gi, display: "BW", expansion: "bitewing radiograph", domain: "dental" },
  { id: "pan", pattern: /\b(?:panos?|pans?)\b/gi, display: "PAN", expansion: "panoramic radiograph", domain: "dental" },
  { id: "fmx", pattern: /\bFM[XS]\b/gi, display: "FMX", expansion: "full-mouth radiographic series", domain: "dental" },
  { id: "cbct", pattern: /\bCBCTs?\b/gi, display: "CBCT", expansion: "cone-beam computed tomography", domain: "dental" },
  { id: "parl", pattern: /\bPARLs?\b/gi, display: "PARL", expansion: "periapical radiolucency", domain: "dental" },

  // ---- Procedures
  { id: "rct", pattern: /\bRCTs?\b/gi, display: "RCT", expansion: "root canal therapy", domain: "dental" },
  { id: "srp", pattern: /\bSRP\b/gi, display: "SRP", expansion: "scaling and root planing", domain: "dental" },
  { id: "ohi", pattern: /\bOHI\b/gi, display: "OHI", expansion: "oral hygiene instruction", domain: "dental" },
  { id: "coe", pattern: /\bCOE\b/gi, display: "COE", expansion: "comprehensive oral evaluation", domain: "dental" },
  { id: "loe", pattern: /\bLOE\b/gi, display: "LOE", expansion: "limited oral evaluation", domain: "dental" },
  {
    id: "ext",
    pattern: /\bEXT\b/g,
    display: "EXT",
    expansion: "extraction",
    alternatives: ["extraction", "extension"],
    domain: "dental"
  },
  { id: "ssc", pattern: /\bSSCs?\b/gi, display: "SSC", expansion: "stainless steel crown", domain: "dental" },
  { id: "sdf", pattern: /\bSDF\b/gi, display: "SDF", expansion: "silver diamine fluoride", domain: "dental" },

  // ---- Materials
  { id: "mta", pattern: /\bMTA\b/gi, display: "MTA", expansion: "mineral trioxide aggregate", domain: "dental" },
  { id: "irm", pattern: /\bIRM\b/gi, display: "IRM", expansion: "intermediate restorative material", domain: "dental" },
  { id: "zoe", pattern: /\bZOE\b/gi, display: "ZOE", expansion: "zinc oxide eugenol", domain: "dental" },
  { id: "rmgi", pattern: /\bRMGI\b/gi, display: "RMGI", expansion: "resin-modified glass ionomer", domain: "dental" },
  {
    id: "gi",
    pattern: /\bGI\b/g,
    display: "GI",
    expansion: "glass ionomer",
    alternatives: ["glass ionomer", "gastrointestinal"],
    domain: "dental"
  },
  {
    id: "gp",
    pattern: /\bGP\b/g,
    display: "GP",
    expansion: "gutta-percha",
    alternatives: ["gutta-percha", "general practitioner"],
    domain: "dental"
  },
  {
    id: "cr",
    pattern: /\bCR\b/g,
    display: "CR",
    expansion: "composite resin",
    alternatives: ["composite resin", "centric relation"],
    domain: "dental"
  },

  // ---- Periodontal and anatomy
  { id: "bop", pattern: /\bBOP\b/gi, display: "BOP", expansion: "bleeding on probing", domain: "dental" },
  {
    id: "cal",
    pattern: /\bCAL\b/g,
    display: "CAL",
    expansion: "clinical attachment level",
    alternatives: ["clinical attachment level", "calcium"],
    domain: "dental"
  },
  { id: "tmj", pattern: /\bTMJs?\b/gi, display: "TMJ", expansion: "temporomandibular joint", domain: "dental" },
  { id: "tmd", pattern: /\bTMD\b/gi, display: "TMD", expansion: "temporomandibular disorder", domain: "dental" },
  { id: "cej", pattern: /\bCEJ\b/gi, display: "CEJ", expansion: "cementoenamel junction", domain: "dental" },
  {
    id: "pd",
    pattern: /\bPD\b/g,
    display: "PD",
    expansion: "probing depth",
    alternatives: ["probing depth", "pocket depth", "partial denture"],
    domain: "dental"
  },

  // ---- Prosthodontics
  { id: "fpd", pattern: /\bFPDs?\b/gi, display: "FPD", expansion: "fixed partial denture", domain: "dental" },
  { id: "rpd", pattern: /\bRPDs?\b/gi, display: "RPD", expansion: "removable partial denture", domain: "dental" },
  { id: "ovd", pattern: /\b(?:OVD|VDO)\b/gi, display: "OVD", expansion: "occlusal vertical dimension", domain: "dental" },

  // ---- Anesthesia
  { id: "ianb", pattern: /\bIANBs?\b/gi, display: "IANB", expansion: "inferior alveolar nerve block", domain: "dental" },
  {
    id: "psa",
    pattern: /\bPSA\b/g,
    display: "PSA",
    expansion: "posterior superior alveolar nerve block",
    // In a medical history PSA is prostate-specific antigen. Expanding it turns
    // a lab value into a nerve block that was never performed.
    alternatives: ["posterior superior alveolar nerve block", "prostate-specific antigen (a lab value)"],
    domain: "dental"
  },
  { id: "n2o", pattern: /\bN2O\b/gi, display: "N2O", expansion: "nitrous oxide", domain: "dental" },
  {
    id: "asa",
    pattern: /\bASA\b/g,
    display: "ASA",
    expansion: "anterior superior alveolar nerve block",
    alternatives: [
      "anterior superior alveolar nerve block",
      "American Society of Anesthesiologists physical status classification",
      "acetylsalicylic acid (aspirin)"
    ],
    domain: "dental"
  },
  {
    id: "la",
    pattern: /\bLA\b/g,
    display: "LA",
    expansion: "local anesthetic",
    alternatives: ["local anesthetic", "local anesthesia"],
    domain: "dental"
  },

  // ---- Chart structure and history
  {
    id: "cc",
    pattern: /\bCC\b/g,
    display: "CC",
    expansion: "chief complaint",
    // CC is a VOLUME (cubic centimetre) at least as often as "chief complaint",
    // and is itself on the ISMP do-not-use list. "2 CC of lidocaine" must never
    // become "2 chief complaint of lidocaine".
    alternatives: ["chief complaint", "cubic centimetres (use mL instead)"],
    domain: "medical"
  },
  { id: "hpi", pattern: /\bHPI\b/gi, display: "HPI", expansion: "history of present illness", domain: "medical" },
  { id: "ros", pattern: /\bROS\b/gi, display: "ROS", expansion: "review of systems", domain: "medical" },
  { id: "nkda", pattern: /\bNKD?A\b/gi, display: "NKDA", expansion: "no known drug allergies", domain: "medical" },
  { id: "fu", pattern: /\bf\/u\b/gi, display: "f/u", expansion: "follow-up", domain: "medical" },
  { id: "bp", pattern: /\bBP\b/g, display: "BP", expansion: "blood pressure", domain: "medical" },
  { id: "npo", pattern: /\bNPO\b/gi, display: "NPO", expansion: "nothing by mouth", domain: "medical" },

  // ---- Dosing. ISMP error-prone list governs which are expanded.
  { id: "bid", pattern: /\bb\.?i\.?d\.(?!\w)|\bbid\b/gi, display: "bid", expansion: "twice daily", domain: "dosing" },
  { id: "tid", pattern: /\bt\.?i\.?d\.(?!\w)|\btid\b/gi, display: "tid", expansion: "three times daily", domain: "dosing" },
  { id: "qid", pattern: /\bq\.?i\.?d\.(?!\w)|\bqid\b/gi, display: "qid", expansion: "four times daily", domain: "dosing" },
  { id: "prn", pattern: /\bp\.?r\.?n\.(?!\w)|\bprn\b/gi, display: "prn", expansion: "as needed", domain: "dosing" },
  {
    // On the ISMP DO-NOT-USE list: "qd" is misread as "qid" and as "qod".
    // Expanding it would be asserting a dosing frequency nobody wrote.
    id: "qd",
    pattern: /\bq\.?d\.(?!\w)|\bqd\b/gi,
    display: "qd",
    expansion: "daily",
    alternatives: ["daily", "four times daily (if qid was intended)", "every other day (if qod was intended)"],
    domain: "dosing"
  },
  {
    id: "qod",
    pattern: /\bq\.?o\.?d\.(?!\w)|\bqod\b/gi,
    display: "qod",
    expansion: "every other day",
    alternatives: ["every other day", "daily (if qd was intended)"],
    domain: "dosing"
  }
];

export const SHORTHAND_BY_ID: ReadonlyMap<string, Shorthand> = new Map(
  SHORTHAND.map((s) => [s.id, s])
);

// Ids in BANNED_ABBREVIATIONS that this table now OWNS.
//
// The two tables overlap because they were written under different policies.
// The old one said "never write this shorthand" and replaced every occurrence.
// The new rule is the standard convention: define the term of art once, then
// the shorthand is not only allowed but preferable — a note that says "scaling
// and root planing" six times is worse writing, not better.
//
// For these ids the first-use expansion wins and the blanket replacement is
// skipped, so a single abbreviation can never be processed by both passes.
// Everything NOT listed here (pt, tx, hx, dx, rx, prophy, x-ray) is shorthand
// for an ordinary word rather than a term of art, and is still replaced
// everywhere — "diagnosis (Dx)" would be absurd.
export const SHORTHAND_OWNS: ReadonlySet<string> = new Set([
  "bw",
  "pano",
  "fmx",
  "rct",
  "srp",
  "ohi",
  "nkda",
  "la",
  "n2o",
  "prn",
  "fu"
]);
