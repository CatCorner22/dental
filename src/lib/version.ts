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
// 2.6.0 — the vocabulary staff actually type: w/, w/o, c/o, MH, BP, ant, iso,
//         epi, lido, fl, tol, mo expand deterministically; perc, endo, imp,
//         temp, mod, cal, tp, cx are flagged as ambiguous rather than guessed;
//         EXT and NKA extend their existing ASK to lower case; PFM and PVS join
//         the first-use terms of art. Measured cause: on notes typed the way
//         staff type them the transformer made ~2 changes each and the AI
//         verifier accepted 0 of 5 faithful rewrites, because the tables are
//         both what the deterministic pass applies AND what licenses a model's
//         expansions.
// 2.7.0 — abbreviation preload: 54 entries across dental terms of art (endodontic
//         working length and irrigants, periodontal grafting and SPT, MRONJ and
//         oroantral communication, prosthodontic and paediatric terms), the
//         medical history that changes dental treatment (HTN, DM, CHF, COPD, CVA,
//         GERD, OSA, SBE, PMH), safe pharmacy sig codes, and a second batch of
//         ISMP / Joint Commission do-not-use constructs (hs/qhs, TIW/BIW, the
//         eye-and-ear Latin set, ss, APAP, cc, D/C) which are FLAGGED AND NEVER
//         EXPANDED, because expanding a dangerous abbreviation launders it.
//         Ambiguous additions (MI, CAD, RA, cap, ac/pc) ask rather than guess.
//         See knowledge/sources/dental-abbreviation-preload.md.
export const RULESET_VERSION = "2.7.0";
