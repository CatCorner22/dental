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
// 2.5.0 — obfuscation screen (phi.obfuscated-digits, phi.hidden-characters):
//         an identifier typed in a non-ASCII decimal script, or split by a
//         zero-width character, was invisible to every \d-based PHI pattern
//         while reading normally to a human. The obfuscation is now the finding,
//         so no pattern has to be taught about Unicode individually.
export const RULESET_VERSION = "2.5.0";
