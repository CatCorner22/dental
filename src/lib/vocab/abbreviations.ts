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
  {
    id: "pt",
    // Lowercase and Title case only — NOT all-caps. "PT" is physical therapy or
    // prothrombin time, and "Pt" is platinum; expanding those invented a
    // clinical statement ("PT referral placed" became "PATIENT referral
    // placed"). The shorthand a clinician means by "patient" is written "pt".
    pattern: /\b[Pp]t\b/g,
    display: "pt",
    replacement: "patient",
    severityClass: "style"
  },
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
  // ---- Joint Commission / ISMP DO NOT USE list.
  //
  // These are not untidy shorthand, they are constructs with a documented
  // history of being MISREAD, and the remedy is always to write the word out.
  // None of them was detected at all before: "insulin 10U" passed this audit
  // clean, which is the single worst miss the list contains, because U read as
  // a zero turns 10 units into 100.
  {
    id: "unit-u",
    // Attached to a number ("10U", "10 u"), which is how the error occurs. A
    // bare capital U in prose is far more likely to be an initial or a tooth
    // reference than a unit, and flagging that would be noise.
    pattern: /\b\d+\s?[Uu]\b/g,
    display: "U (units)",
    replacement: 'write "units" in full — U is read as a zero, so 10U becomes 100',
    severityClass: "review"
  },
  {
    id: "unit-iu",
    pattern: /\b\d+\s?IU\b|\bIU\b/g,
    display: "IU",
    replacement: 'write "international units" in full — IU is read as IV or as the number 10',
    severityClass: "review"
  },
  {
    id: "morphine-ms",
    // MS is morphine sulfate or magnesium sulfate, and the two are confused in
    // both directions. There is no safe expansion, only the full drug name.
    pattern: /\bMSO4\b|\bMgSO4\b|\bMS\b(?!\s*(?:Word|Office))/g,
    display: "MS / MSO4 / MgSO4",
    // The guidance has to cover all three readings, because the flag fires on
    // all three. "Write the full drug name" is right for a prescription and
    // simply wrong for "History of MS" — and guidance that does not match what
    // the reader is looking at is how a rule gets dismissed. Being ambiguous
    // across a drug AND a diagnosis is exactly why the term is on the list.
    replacement:
      "write the term out in full — MS is read as morphine sulfate, as magnesium sulfate, and as multiple sclerosis",
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
  },

  // -------------------------------------------------------------------------
  // The shorthand staff actually type
  // -------------------------------------------------------------------------
  //
  // Added after MEASURING the transformer against notes written the way a
  // hygienist types them between patients. The result was that it made about two
  // substantive changes per note and walked straight past c/o, w/, mh, bp, epi,
  // lido, ant, iso, ext, perc, imp, temp, mod, cal, tp and cx. A transformer that
  // does not know the practice's own vocabulary is not a transformer.
  //
  // The same gap disabled the AI layer completely. The meaning verifier licenses
  // a rewrite to introduce a word only when a table entry it triggers produces
  // that word — so with these missing, a model correctly expanding "w/ epi" to
  // "with epinephrine" was refused for changing the drug list, and correctly
  // expanding "mh" to "medical history" was refused for moving a negation. Zero
  // of five realistic rewrites survived. One table, both transformers.
  //
  // The split below is the file's existing rule, applied honestly: "style" means
  // the expansion is fixed and adds no clinical claim, "review" means the real
  // expansion needs a fact the shorthand is hiding, so the tool asks instead of
  // guessing. Several of these are genuinely ambiguous in a dental chart and the
  // ambiguity is not academic — "mod" is both "moderate" and the MOD surfaces,
  // and a measured note used it in both senses two lines apart.

  {
    // BEFORE the "w/" entry, and the lookahead in that pattern is the real
    // protection: "w/o" is a NEGATION, and turning it into "with o" would invert
    // a clinical statement. Belt and braces, because the cost of getting this
    // one wrong is a note that says the opposite of what happened.
    id: "wo",
    pattern: /\bw\/o\b/gi,
    display: "w/o",
    replacement: "without",
    severityClass: "style"
  },
  {
    id: "w-with",
    // Only when a space follows, so "w/o" can never be reached by this rule
    // whatever order the table is walked in.
    pattern: /\bw\/(?=\s)/gi,
    display: "w/",
    replacement: "with",
    severityClass: "style"
  },
  {
    id: "co",
    pattern: /\bc\/o\b/gi,
    display: "c/o",
    replacement: "complains of",
    severityClass: "style"
  },
  {
    id: "mh",
    pattern: /\bMH\b/gi,
    display: "MH",
    replacement: "medical history",
    severityClass: "style"
  },
  {
    id: "bp",
    pattern: /\bBP\b/gi,
    display: "BP",
    replacement: "blood pressure",
    severityClass: "style"
  },
  {
    id: "ant-anterior",
    pattern: /\bant\b/gi,
    display: "ant",
    replacement: "anterior",
    severityClass: "style"
  },
  {
    id: "iso",
    pattern: /\biso\b/gi,
    display: "iso",
    replacement: "isolation",
    severityClass: "style"
  },
  {
    // Expanded rather than flagged, and that is a dose-safety judgement rather
    // than a wording one: in a dental operatory "epi" is the vasoconstrictor,
    // and spelling it out makes the agent explicit to anyone later reading the
    // anesthetic record. Leaving it as three letters hides a drug.
    id: "epi",
    pattern: /\bepi\b/gi,
    display: "epi",
    replacement: "epinephrine",
    severityClass: "style"
  },
  {
    id: "lido",
    pattern: /\blido\b/gi,
    display: "lido",
    replacement: "lidocaine",
    severityClass: "style"
  },
  {
    id: "fl-fluoride",
    pattern: /\bfl\b/gi,
    display: "fl",
    replacement: "fluoride",
    severityClass: "style"
  },

  {
    // "pt tol well" is the writer asserting an outcome in three letters. Spelling
    // it out is a vocabulary change, and it hands the sentence to the vague-phrase
    // rule, which then asks for the response actually observed — the behaviour the
    // practice wants.
    //
    // Note the distinction this preserves, which is the whole design of the
    // grounding check: expanding "tol" is licensed because the NOTE SAYS IT,
    // while a model adding "tolerated the procedure well" to a note that never
    // said it is still refused as a fabricated outcome claim. Same word, opposite
    // verdicts, decided by whether the writer wrote it.
    id: "tol",
    pattern: /\btol\b/gi,
    display: "tol",
    replacement: "tolerated",
    severityClass: "style"
  },
  {
    id: "mo-months",
    pattern: /\bmo\b/gi,
    display: "mo",
    replacement: "months",
    severityClass: "style"
  },

  // ---- Ambiguous: the tool asks, because the reading changes the record.
  {
    id: "perc",
    // "perc + on #14" is percussion. "perc 5/325" is a controlled substance.
    // Guessing between a diagnostic test and an opioid is not a wording call.
    pattern: /\bperc\b/gi,
    display: "perc",
    replacement: "percussion, or Percocet — write the full word (a drug name is never abbreviated)",
    severityClass: "review"
  },
  {
    id: "endo",
    pattern: /\bendo\b/gi,
    display: "endo",
    replacement:
      "endodontics or the endodontist, or endocarditis (as in antibiotic prophylaxis) — write which",
    severityClass: "review"
  },
  {
    id: "imp",
    pattern: /\bimp\b/gi,
    display: "imp",
    replacement: "impression, or implant — write which one this was",
    severityClass: "review"
  },
  {
    id: "temp",
    pattern: /\btemp\b/gi,
    display: "temp",
    replacement: "temporary restoration, or temperature — write which",
    severityClass: "review"
  },
  {
    // The measured note that proved this needed to be a flag used "mod" for
    // "moderate calculus" and for a "mod composite" — the MOD surfaces — within
    // eight lines. One is an observation, the other is a billable site.
    id: "mod",
    pattern: /\bmod\b/gi,
    display: "mod",
    replacement:
      "moderate, or the mesial-occlusal-distal (MOD) surfaces — write which (the surfaces are a billed site)",
    severityClass: "review"
  },
  {
    id: "cal",
    pattern: /\bcal\b/gi,
    display: "cal",
    replacement: "calculus, or clinical attachment loss (CAL) — write which",
    severityClass: "review"
  },
  {
    id: "tp",
    pattern: /\btp\b/gi,
    display: "tp",
    replacement: "treatment plan, or toothpaste — write which",
    severityClass: "review"
  },
  {
    id: "cx",
    pattern: /\bcx\b/gi,
    display: "cx",
    replacement: "continuing care, cancelled, or complications — write which",
    severityClass: "review"
  }
];
