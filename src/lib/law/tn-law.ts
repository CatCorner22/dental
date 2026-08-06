// THE TENNESSEE AUTHORITY LIBRARY — the law behind every rule this app enforces.
//
// Typed data, not prose, for three reasons:
//  1. CITED AND LINKED. Every entry carries its citation and an official (or
//     clearly-labelled mirror) URL, so "the rule says" is always one click from
//     the rule itself.
//  2. WIRED TO THE APP. `appEnforcement` names the audit rules, gates, and
//     features that implement each authority — the page can show, for every
//     law, exactly where this software earns its keep. A law library that
//     cannot point at its own enforcement is a brochure.
//  3. TESTABLE. Integrity tests hold every entry to the same standards as the
//     advisors: unique ids, allow-listed official domains, language vigilance
//     on every summary, resolvable cross-references.
//
// NOT LEGAL ADVICE. The page banner says so; entries summarize for staff
// training and cite the primary source for verification. Citations follow the
// owner's ingested blueprints (knowledge/sources/tn-des12-legal-blueprint.md,
// tn-dental-legal-best-practices.md); nothing here has been independently
// Shepardized, and the caveat is inherited deliberately.

export type AuthorityCategory =
  | "statute" // Tennessee Code Annotated
  | "rule" // Board of Dentistry rules (Tenn. Comp. R. & Regs. 0460)
  | "session-law" // Public Chapters not yet compiled
  | "federal" // HIPAA, OSHA, DEA overlays
  | "ethics" // Professional conduct standards
  | "safety-standard"; // Joint Commission, ISMP, CDC

export interface Authority {
  id: string;
  category: AuthorityCategory;
  title: string;
  /** Formal citation, as a reader would quote it. */
  citation: string;
  /** Primary link. Official domain wherever one exists. */
  url: string;
  /** True when the link is a maintained mirror rather than the official text. */
  unofficialMirror?: boolean;
  /** What the authority says, in two sentences or fewer. */
  summary: string;
  /** What it changes about daily dental practice in Tennessee. */
  practiceImpact: string;
  /** Audit rules / gates / features in THIS app that implement it. */
  appEnforcement: string[];
  /** Cross-references within this library. */
  relatedIds: string[];
}

export const TN_AUTHORITIES: readonly Authority[] = [
  // ---- Statutes (Tennessee Code Annotated) --------------------------------
  {
    id: "tca-63-5",
    category: "statute",
    title: "Tennessee Dental Practice Act",
    citation: "Tenn. Code Ann. Title 63, Chapter 5",
    url: "https://law.justia.com/codes/tennessee/title-63/chapter-5/",
    unofficialMirror: true,
    summary:
      "The statute that creates the practice of dentistry in Tennessee: licensure, the Board of Dentistry, scope of practice for dentists, hygienists, and assistants, and the Board's authority to write rules.",
    practiceImpact:
      "Everything the Board's rules require flows from this delegation. Scope-of-practice boundaries — who may diagnose, who may perform which duties under which supervision — are statutory, not house policy.",
    appEnforcement: ["role-based scope lock (diagnosis reserved to dentist)", "supervision fields in universal-core"],
    relatedIds: ["rule-0460-02", "tca-63-5-108", "pc-1107-2026"]
  },
  {
    id: "tca-63-5-108",
    category: "statute",
    title: "Practice of dentistry and dental hygiene defined; delegation",
    citation: "Tenn. Code Ann. § 63-5-108",
    url: "https://law.justia.com/codes/tennessee/title-63/chapter-5/section-63-5-108/",
    unofficialMirror: true,
    summary:
      "Defines the practice of dentistry and dental hygiene, what may be delegated under direct supervision and full dentist responsibility, which acts require professional judgment (diagnosis, treatment planning, surgery/cutting except hygiene curettage/root planing, radiograph interpretation, most anesthesia), hygienist-only scaling among auxiliaries, general-supervision conditions for hygienists, hygienist:dentist ratios, and limited hygienist prescribing.",
    practiceImpact:
      "Radiographs and their interpretations are part of the dental record. Scope charts on this page summarize can / cannot by license level — staff still verify the current Code text before relying on any boundary.",
    appEnforcement: [
      "imaging-interpretation completeness rule",
      "Byte: radiograph-interpretation advice",
      "retrieval: radiograph records",
      "license scope charts (/reference/tennessee-law)",
      "role-based scope lock (diagnosis reserved to dentist)"
    ],
    relatedIds: [
      "rule-0460-02-12",
      "tca-63-5",
      "rule-0460-03-09",
      "rule-0460-04-08",
      "pc-1107-2026"
    ]
  },
  {
    id: "tca-63-2-101",
    category: "statute",
    title: "Release of medical records on request",
    citation: "Tenn. Code Ann. § 63-2-101",
    url: "https://law.justia.com/codes/tennessee/title-63/chapter-2/section-63-2-101/",
    unofficialMirror: true,
    summary:
      "A provider must furnish a patient's records within ten working days of a written request. A summary does not satisfy the right to the full record.",
    practiceImpact:
      "Export and retrieval have a statutory clock. Patient-readable summaries are supplemental — the full record is what the patient is entitled to, and the practice must be able to produce it fast.",
    appEnforcement: ["frozen immutable submissions", "patient-readable summary labelled supplemental, never substitute"],
    relatedIds: ["rule-0460-02-12", "hipaa-privacy"]
  },
  {
    id: "tca-63-1-176",
    category: "statute",
    title: "Consent for treatment of minors",
    citation: "Tenn. Code Ann. § 63-1-176",
    url: "https://law.justia.com/codes/tennessee/title-63/chapter-1/",
    unofficialMirror: true,
    summary:
      "Parental or guardian consent is required to treat a minor, with exceptions for emancipated minors, mature minors by provider judgement, and emergencies.",
    practiceImpact:
      "For a minor's visit, the record should identify the consenting adult and their relationship. An undocumented consenting adult is an undocumented consent.",
    appEnforcement: ["consent decision completeness rule", "retrieval: consent documentation"],
    relatedIds: ["rule-0460-02-12", "ada-ethics"]
  },
  {
    id: "tca-53-10-310",
    category: "statute",
    title: "Controlled Substance Monitoring Database check",
    citation: "Tenn. Code Ann. § 53-10-310",
    url: "https://www.tn.gov/health/health-program-areas/health-professional-boards/csmd-board.html",
    summary:
      "Prescribers must check Tennessee's Controlled Substance Monitoring Database (CSMD) before prescribing opioids and other monitored substances, with narrow exceptions.",
    practiceImpact:
      "An opioid prescription without a documented CSMD check is a compliance gap on its face. One line — CSMD checked, date, findings — makes the check visible to any reviewer.",
    appEnforcement: ["opioid PMP/CSMD audit rule", "Byte: opioid-pmp advice", "CSMD/PMP vocabulary (ruleset 2.15.0)"],
    relatedIds: ["rule-0460-02", "dea-registration"]
  },

  // ---- Session law not yet compiled ---------------------------------------
  {
    id: "pc-1107-2026",
    category: "session-law",
    title: "Public Chapter 1107 (2026) — hygienist supervision of new patients",
    citation: "2026 Tenn. Pub. Ch. 1107, effective January 1, 2027",
    url: "https://www.capitol.tn.gov/",
    summary:
      "From January 1, 2027, a dental hygienist must be under direct supervision of a dentist who has seen a new patient before completing diagnostic radiographs, hard- or soft-tissue data collection, prophylaxis, or fluoride application.",
    practiceImpact:
      "New-patient hygiene workflows change on a date certain. Scheduling, supervision documentation, and the note's patient-status and supervision fields all have to agree before the law is in force.",
    appEnforcement: ["supervision-2027 effective-dated audit rule", "patient-status and supervision fields in universal-core"],
    relatedIds: ["tca-63-5", "rule-0460-03"]
  },

  // ---- Board of Dentistry rules (Tenn. Comp. R. & Regs. 0460) -------------
  {
    id: "rule-0460-01",
    category: "rule",
    title: "Board of Dentistry — General Rules",
    citation: "Tenn. Comp. R. & Regs. 0460-01",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-01.pdf",
    summary:
      "Definitions, Board processes, and requirements that apply across dentists, hygienists, and assistants.",
    practiceImpact: "The shared vocabulary the profession-specific chapters build on.",
    appEnforcement: ["terminology tables mirror rule vocabulary"],
    relatedIds: ["rule-0460-02", "rule-0460-03", "rule-0460-04"]
  },
  {
    id: "rule-0460-02",
    category: "rule",
    title: "Rules Governing the Practice of Dentistry",
    citation: "Tenn. Comp. R. & Regs. 0460-02",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-02.pdf",
    summary:
      "The dentist chapter: licensure, continuing education, anesthesia and sedation permits, advertising, and patient records.",
    practiceImpact:
      "The chapter Tennessee disciplinary actions cite most. Its records rule (.12) and sedation rule (.07) are the two this application enforces line by line.",
    appEnforcement: ["records completeness rule family", "sedation module and checklist"],
    relatedIds: ["rule-0460-02-12", "rule-0460-02-07", "tca-63-5"]
  },
  {
    id: "rule-0460-02-12",
    category: "rule",
    title: "Patient records — minimum content and retention",
    citation: "Tenn. Comp. R. & Regs. 0460-02-.12",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-02.pdf",
    summary:
      "The minimum elements of a Tennessee dental record — concise medical history, findings, treatment rendered, and more — with retention of seven years from last professional contact for adults.",
    practiceImpact:
      "The floor every note must clear. Real discipline has issued for missing elements (Jones 2018, Brewer 2020, Cordice 2018): the completeness rules are enforced requirements, not style. Corrections are by dated, signed addendum — the original entry is never rewritten.",
    appEnforcement: [
      "audit completeness rules (medical history, findings, consent, follow-up)",
      "addendum template; frozen immutable submissions",
      "Byte: allergy-status, amendment-not-erasure advice",
      "retrieval: record correction"
    ],
    relatedIds: ["rule-0460-02", "tca-63-2-101", "retention-minors"]
  },
  {
    id: "rule-0460-02-07",
    category: "rule",
    title: "Anesthesia and sedation",
    citation: "Tenn. Comp. R. & Regs. 0460-02-.07",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-02.pdf",
    summary:
      "Permits, monitoring, personnel, and record requirements for administering anesthesia and sedation in dental settings.",
    practiceImpact:
      "A sedation record needs the time-oriented drug and monitoring log, pre-operative evaluation, and discharge criteria — reviewable elements a Board inspection asks for by name.",
    appEnforcement: ["sedation-anesthesia module", "sedation record template", "Byte: nitrous-record advice", "retrieval: sedation record elements"],
    relatedIds: ["rule-0460-02", "safety-jc-dnu"]
  },
  {
    id: "rule-0460-03",
    category: "rule",
    title: "Rules Governing the Practice of Dental Hygienists",
    citation: "Tenn. Comp. R. & Regs. 0460-03",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-03.pdf",
    summary: "Hygienist licensure, permissible duties, and supervision requirements.",
    practiceImpact:
      "Defines which hygiene acts require which supervision level — the baseline Public Chapter 1107 tightens for new patients in 2027.",
    appEnforcement: ["supervision-2027 rule", "role-based scope lock", "license scope charts"],
    relatedIds: ["pc-1107-2026", "rule-0460-04", "rule-0460-03-09", "tca-63-5-108"]
  },
  {
    id: "rule-0460-03-09",
    category: "rule",
    title: "Dental hygienist — scope of practice",
    citation: "Tenn. Comp. R. & Regs. 0460-03-.09",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-03.pdf",
    summary:
      "Lists delegable hygiene duties, which acts require direct supervision (root planing/subgingival curettage, N2O, local anesthesia, restorative/prosthetic functions), and prohibited procedures (comprehensive exam, diagnosis, treatment planning, and other reserved acts).",
    practiceImpact:
      "The hygienist can / cannot chart on the Tennessee law page is drawn from this rule plus Tenn. Code Ann. § 63-5-108. Certification rules (.06, .10, .12) gate N2O, restorative/prosthetic, and local anesthesia.",
    appEnforcement: ["license scope charts", "role-based scope lock", "supervision-2027 rule"],
    relatedIds: ["rule-0460-03", "tca-63-5-108", "pc-1107-2026"]
  },
  {
    id: "rule-0460-04",
    category: "rule",
    title: "Rules Governing Dental Assistants",
    citation: "Tenn. Comp. R. & Regs. 0460-04",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-04.pdf",
    summary: "Practical and registered dental assistant levels, certification pathways, and scope.",
    practiceImpact:
      "Assistant-performed duties must sit inside the registered (or practical) scope; the note's attribution shows who did what, which is how scope compliance is demonstrated after the fact.",
    appEnforcement: ["attribution requirements (active-voice coaching, residue rule)", "license scope charts"],
    relatedIds: ["rule-0460-03", "tca-63-5", "rule-0460-04-08", "tca-63-5-108"]
  },
  {
    id: "rule-0460-04-08",
    category: "rule",
    title: "Dental assistants — scope of practice",
    citation: "Tenn. Comp. R. & Regs. 0460-04-.08",
    url: "https://publications.tnsosfiles.com/rules/0460/0460-04.pdf",
    summary:
      "Delegable assistant duties, certification-gated acts (coronal polish, N2O monitoring, sealants, expanded restorative/prosthetic, radiology), and a long prohibited list including diagnosis, scaling/curettage, local anesthesia administration, and uncertified expanded duties.",
    practiceImpact:
      "Practical assistants must not invade RDA-only procedures (also Rule 0460-04-.01). The RDA / practical DA scope cards cite this rule section by section.",
    appEnforcement: ["license scope charts", "attribution requirements (active-voice coaching, residue rule)"],
    relatedIds: ["rule-0460-04", "rule-0460-01", "tca-63-5-108"]
  },
  {
    id: "retention-minors",
    category: "rule",
    title: "Retention for minors — Department of Health standard",
    citation: "TN Dept. of Health Standards of Practice Manual (minors: minority + 1 year, or 10 years from last service, whichever is longer)",
    url: "https://www.tn.gov/health.html",
    summary:
      "A different authority from the Board rule: for minors, the Department of Health manual extends retention to majority-plus-one-year or ten years, whichever is longer. The Board rule's floor stays seven.",
    practiceImpact:
      "Taking the longer period satisfies either reading; taking seven for a child does not. Retention policy should say 'adults seven years; minors the longer of the two standards' and cite both.",
    appEnforcement: ["reference documentation (this library resolves the 7-vs-10 discrepancy)"],
    relatedIds: ["rule-0460-02-12"]
  },

  // ---- Federal overlays ----------------------------------------------------
  {
    id: "hipaa-privacy",
    category: "federal",
    title: "HIPAA Privacy and Security Rules (2026 Security Rule updates)",
    citation: "45 C.F.R. Parts 160, 164; 2026 Security Rule Final Rule",
    url: "https://www.hhs.gov/hipaa/index.html",
    summary:
      "Federal floor for protected health information. The 2026 Security Rule update removes the 'addressable' loophole: MFA for all ePHI access, encryption at rest and in transit, documented asset inventory, annual risk analysis, tested incident response.",
    practiceImpact:
      "Every system touching PHI — including this one's deliberate design of touching none — is measured against these controls. De-identification before any AI call is the posture that keeps the model layer outside the ePHI boundary.",
    appEnforcement: ["PHI gate before every provider call", "de-identified drafting premise", "MFA support", "no note text in logs"],
    relatedIds: ["tca-63-2-101", "osha-bloodborne"]
  },
  {
    id: "osha-bloodborne",
    category: "federal",
    title: "OSHA Bloodborne Pathogens Standard",
    citation: "29 C.F.R. § 1910.1030",
    url: "https://www.osha.gov/bloodborne-pathogens",
    summary:
      "Exposure control for occupational contact with blood and other potentially infectious materials — training, engineering controls, post-exposure protocols.",
    practiceImpact:
      "Incident documentation (exposure events, post-exposure follow-up) has its own federal record requirements alongside the clinical note.",
    appEnforcement: ["complication/incident documentation prompts"],
    relatedIds: ["hipaa-privacy", "cdc-infection-control"]
  },
  {
    id: "dea-registration",
    category: "federal",
    title: "DEA registration and controlled-substance prescribing",
    citation: "21 C.F.R. Part 1301 et seq.",
    url: "https://www.deadiversion.usdoj.gov/",
    summary:
      "Federal registration and recordkeeping requirements for prescribing controlled substances, layered under Tennessee's CSMD mandate.",
    practiceImpact:
      "Opioid documentation answers to two sovereigns: the federal prescription record and the state monitoring check, and the note is where both leave their trace.",
    appEnforcement: ["opioid PMP/CSMD audit rule", "prescription completeness rules"],
    relatedIds: ["tca-53-10-310"]
  },

  // ---- Ethics and safety standards ----------------------------------------
  {
    id: "ada-ethics",
    category: "ethics",
    title: "ADA Principles of Ethics and Code of Professional Conduct",
    citation: "American Dental Association, Principles of Ethics and Code of Professional Conduct",
    url: "https://www.ada.org/about/principles/code-of-ethics",
    summary:
      "The profession's five principles — patient autonomy, nonmaleficence, beneficence, justice, and veracity — with conduct rules the ADA enforces on members and boards commonly look to.",
    practiceImpact:
      "Veracity and autonomy are documentation principles as much as chairside ones: records that say what happened, consent that records a real conversation, refusals respected and documented.",
    appEnforcement: ["consent-is-a-conversation advice", "informed refusal retrieval and advice", "no invented facts anywhere in the AI layer"],
    relatedIds: ["tca-63-1-176", "rule-0460-02-12"]
  },
  {
    id: "safety-jc-dnu",
    category: "safety-standard",
    title: "Joint Commission 'Do Not Use' abbreviation list",
    citation: "The Joint Commission, Official 'Do Not Use' List (NPSG)",
    url: "https://www.jointcommission.org/standards/national-patient-safety-goals/",
    summary:
      "Abbreviations that have caused documented patient harm — U for units, QD/QOD, trailing zeros, missing leading zeros, MS/MSO4 — must be written out.",
    practiceImpact:
      "A dose written with a banned abbreviation is a misreading waiting for a tired reader. The list is enforced here as a filing gate, not a suggestion.",
    appEnforcement: ["do-not-use tier of the shorthand filing gate", "abbreviation tables flag-and-never-expand"],
    relatedIds: ["safety-ismp", "rule-0460-02-07"]
  },
  {
    id: "safety-ismp",
    category: "safety-standard",
    title: "ISMP List of Error-Prone Abbreviations",
    citation: "Institute for Safe Medication Practices, Error-Prone Abbreviations List",
    url: "https://www.ismp.org/recommendations/error-prone-abbreviations-list",
    summary:
      "The broader companion to the Joint Commission list: symbols, dose designations, and drug-name abbreviations documented in medication-error reports.",
    practiceImpact:
      "Source of the practice's expanded banned-abbreviation set and of the eye-and-ear Latin trap that once caught this app's own advice text ('Referred to OS').",
    appEnforcement: ["banned abbreviation tables", "medication-safety rules"],
    relatedIds: ["safety-jc-dnu"]
  },
  {
    id: "cdc-infection-control",
    category: "safety-standard",
    title: "CDC Guidelines for Infection Control in Dental Health-Care Settings",
    citation: "CDC, Guidelines for Infection Control in Dental Health-Care Settings",
    url: "https://www.cdc.gov/dental-infection-control/hcp/summary/index.html",
    summary:
      "The infection-prevention baseline for dental settings: sterilization, PPE, waterline safety, and program administration.",
    practiceImpact:
      "Instrument-sterilization and protective-measure documentation in operative notes traces to this baseline.",
    appEnforcement: ["isolation and protective-measures fields in templates"],
    relatedIds: ["osha-bloodborne"]
  }
] as const;

export const CATEGORY_LABEL: Record<AuthorityCategory, string> = {
  statute: "Tennessee statutes (TCA)",
  "session-law": "New session law",
  rule: "Board of Dentistry rules (0460)",
  federal: "Federal overlays",
  ethics: "Professional ethics",
  "safety-standard": "Patient-safety standards"
};

export const CATEGORY_ORDER: readonly AuthorityCategory[] = [
  "statute",
  "session-law",
  "rule",
  "federal",
  "ethics",
  "safety-standard"
];

export function authoritiesByCategory(): Map<AuthorityCategory, Authority[]> {
  const map = new Map<AuthorityCategory, Authority[]>();
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const a of TN_AUTHORITIES) map.get(a.category)!.push(a);
  return map;
}

export function authorityById(id: string): Authority | undefined {
  return TN_AUTHORITIES.find((a) => a.id === id);
}
