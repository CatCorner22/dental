// "Replace ambiguous shorthand" — mirrors skill/references/terminology-and-style.md.
// The /reference/abbreviations page renders this list, so the reference page can
// never drift from what the audit enforces.
//
// severityClass "style" (S3): the replacement is deterministic language-only.
// severityClass "review" (S2): the true replacement needs clinical facts the
// shorthand hides (counts, sites, depth, verification), so a clinician confirms.

export interface BannedAbbreviation {
  id: string;
  pattern: RegExp; // must carry the g flag (scanned with matchAll)
  display: string; // shorthand as staff type it
  replacement: string; // "use when true"
  severityClass: "style" | "review";
}

export const BANNED_ABBREVIATIONS: BannedAbbreviation[] = [
  {
    id: "xray",
    pattern: /\bx[- ]?rays?\b/gi,
    display: "X-ray",
    replacement: "radiograph",
    severityClass: "style"
  },
  {
    id: "pa",
    pattern: /\bPA\b/g,
    display: "PA",
    replacement: "periapical radiograph or posteroanterior cephalometric radiograph",
    severityClass: "review"
  },
  {
    id: "bw",
    pattern: /\bBWX?s?\b/g,
    display: "BW / BWX",
    replacement: "bitewing radiograph, with count and orientation",
    severityClass: "review"
  },
  {
    id: "pano",
    pattern: /\bpano\b/gi,
    display: "PANO",
    replacement: "panoramic radiograph",
    severityClass: "style"
  },
  {
    id: "fmx",
    pattern: /\bFM[XS]\b/g,
    display: "FMX / FMS",
    replacement: "full-mouth intraoral radiographic series, with count",
    severityClass: "review"
  },
  {
    id: "wnl",
    pattern: /\bWNL\b/gi,
    display: "WNL",
    replacement: "name the examined structure and finding",
    severityClass: "review"
  },
  {
    id: "nad",
    pattern: /\bNAD\b/g,
    display: "NAD",
    replacement: "no acute distress observed, limited to the observation period",
    severityClass: "review"
  },
  {
    id: "sp",
    pattern: /\bs\/p\b/gi,
    display: "S/P",
    replacement: "after or history of, whichever is true",
    severityClass: "review"
  },
  { id: "tx", pattern: /\btx\b/gi, display: "tx", replacement: "treatment", severityClass: "style" },
  { id: "pt", pattern: /\bpt\b/gi, display: "pt", replacement: "patient", severityClass: "style" },
  { id: "hx", pattern: /\bhx\b/gi, display: "hx", replacement: "history", severityClass: "style" },
  { id: "dx", pattern: /\bdx\b/gi, display: "dx", replacement: "diagnosis", severityClass: "style" },
  {
    id: "rx",
    pattern: /\brx\b/gi,
    display: "rx",
    replacement: "prescription or treatment; choose one",
    severityClass: "review"
  },
  {
    id: "la",
    pattern: /\bLA\b/g,
    display: "LA",
    replacement: "local anesthetic",
    severityClass: "style"
  },
  {
    id: "n2o",
    pattern: /\bN2O\b/gi,
    display: "N2O",
    replacement: "nitrous oxide and oxygen inhalation sedation",
    severityClass: "style"
  },
  {
    id: "ivs",
    pattern: /\bIVS\b/g,
    display: "IVS",
    replacement: "intravenous sedation, with intended and achieved depth",
    severityClass: "review"
  },
  {
    id: "ebl",
    pattern: /\bEBL\b/g,
    display: "EBL",
    replacement: "estimated blood loss, with amount and unit",
    severityClass: "review"
  },
  {
    id: "prn",
    pattern: /\bp\.?r\.?n\.?(?=[\s,.;:)]|$)/gi,
    display: "PRN",
    replacement: "state the condition and action in patient instructions",
    severityClass: "review"
  },
  {
    id: "nkda",
    pattern: /\bNKD?A\b/g,
    display: "NKDA / NKA",
    replacement: "no known drug allergies or no known allergies, only when verified",
    severityClass: "review"
  },
  {
    id: "rct",
    pattern: /\bRCT\b/g,
    display: "RCT",
    replacement: "root canal treatment",
    severityClass: "style"
  },
  {
    id: "srp",
    pattern: /\bSRP\b/g,
    display: "SRP",
    replacement: "scaling and root planing, with sites",
    severityClass: "review"
  },
  {
    id: "prophy",
    pattern: /\bprophy\b/gi,
    display: "prophy",
    replacement: "prophylaxis",
    severityClass: "style"
  },
  {
    id: "ind",
    pattern: /\bI\s?&\s?D\b/g,
    display: "I&D",
    replacement: "incision and drainage",
    severityClass: "style"
  },
  {
    id: "ohi",
    pattern: /\bOHI\b/g,
    display: "OHI",
    replacement: "oral hygiene instruction",
    severityClass: "style"
  },
  {
    id: "poi",
    pattern: /\bPOI\b/g,
    display: "POI",
    replacement: "postoperative instructions",
    severityClass: "style"
  },
  {
    id: "fu",
    pattern: /\bF\/U\b/gi,
    display: "F/U",
    replacement: "follow-up",
    severityClass: "style"
  }
];
