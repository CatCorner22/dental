// The single source of truth for the deterministic ruleset version. It is
// stamped onto every submission and audit report and frozen into the
// submissions record, so a later change to the rules never silently rewrites
// what a past note was audited against. Bump on any change to audit rules,
// module definitions, or controlled vocabulary.
// 2.1.0 — plural-preserving first-use shorthand expansion (pluralExpansion):
//         "SSCs" no longer expands to a singular; counts survive.
// 2.2.0 — Mockingbird medication-safety gates (kg rule, dose reconciliation,
//         household units, dental interaction screens), effort gates
//         (gibberish, unprofessional tone), and anticipatory completeness
//         rules (imaging interpretation, anesthetic amount, extraction
//         outcome, prescription duration, consent decision).
// 2.3.0 — robotic-assisted surgery module; sedation module gains the
//         monitors-in-use list and emergency-preparedness confirmation;
//         opioid prescriptions require a documented CSMD/PMP check.
// 2.4.0 — billing-narrative justification rules (SRP periodontal evidence,
//         core-buildup retention, crown necessity) and the note GPA stamp
//         (deriveGpa v1) frozen onto filings.
// 2.5.0 — the patient-experience layer and its review pass. The plain-language
//         rule set and the "plain-language" category; suppression of STYLE
//         abbreviation findings inside patient-facing text; the anxiety-comfort
//         module; the "Written for the patient" and "Open items" sections of
//         universal-core; telephone and portal encounter types; PLAIN_WORDS,
//         the quadrant and s/s shorthand, four lexicon words, and a widened
//         vague.moderate carve-out.
//
//         Recorded rather than tidied away: this layer merged under 2.1.0 and
//         went unstamped until now, so notes filed in that window carry a
//         version that does not describe the rules that ran. That is the exact
//         failure this constant exists to prevent, and the CI guard added in
//         2.4.0 is what stops it happening again.
// 2.6.0 — the privacy screen, corrected in both directions at once.
//         Catches: a name announced by a chained cue ("referred to dr. john
//         smith" was missed entirely, by this rule and by phi.name both), four
//         more date formats (YYYY/MM/DD, MM.DD.YYYY, "2 August 2026",
//         02-AUG-2026), and the note TITLE, which was never screened at all
//         while becoming the emailed attachment filename.
//         Stops crying wolf about: "MS Contin" (morphine sulfate, previously S0
//         — a blocked opioid entry), "MR Imaging", "DR Sensor", "IAN
//         INJECTION", "FRANK PUS", "MAX CENTRAL".
//         Both directions in one version on purpose: a screen that misses real
//         names is useless, and one that blocks real clinical terms gets muted,
//         which is the same failure a step later.
export const RULESET_VERSION = "2.6.0";
