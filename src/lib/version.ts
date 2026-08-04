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
// 2.6.0 — obfuscation screen (phi.obfuscated-digits, phi.hidden-characters):
//         an identifier typed in a non-ASCII decimal script, or split by a
//         zero-width character, was invisible to every \d-based PHI pattern
//         while reading normally to a human. The obfuscation is now the finding,
//         so no pattern has to be taught about Unicode individually.
// 2.7.0 — the vocabulary staff actually type: w/, w/o, c/o, MH, BP, ant, iso,
//         epi, lido, fl, tol, mo expand deterministically; perc, endo, imp,
//         temp, mod, cal, tp, cx are flagged as ambiguous rather than guessed;
//         EXT and NKA extend their existing ASK to lower case; PFM and PVS join
//         the first-use terms of art. Measured cause: on notes typed the way
//         staff type them the transformer made ~2 changes each and the AI
//         verifier accepted 0 of 5 faithful rewrites, because the tables are
//         both what the deterministic pass applies AND what licenses a model's
//         expansions.
// 2.8.0 — abbreviation preload: 54 entries across dental terms of art (endodontic
//         working length and irrigants, periodontal grafting and SPT, MRONJ and
//         oroantral communication, prosthodontic and paediatric terms), the
//         medical history that changes dental treatment (HTN, DM, CHF, COPD, CVA,
//         GERD, OSA, SBE, PMH), safe pharmacy sig codes, and a second batch of
//         ISMP / Joint Commission do-not-use constructs (hs/qhs, TIW/BIW, the
//         eye-and-ear Latin set, ss, APAP, cc, D/C) which are FLAGGED AND NEVER
//         EXPANDED, because expanding a dangerous abbreviation launders it.
//         Ambiguous additions (MI, CAD, RA, cap, ac/pc) ask rather than guess.
//         See knowledge/sources/dental-abbreviation-preload.md.
// 2.9.0 — text-to-STRUCTURE. A read-only extraction layer (src/lib/extract)
//         parses clauses into clinical facts — tooth sites with surfaces,
//         procedures with a coarse category — and a ConText assertion layer
//         decides whether the note affirmed or denied each one. New controlled
//         vocabulary: vocab/procedures.ts.
//
//         Stamped because the facts a note yields are now part of what the
//         ruleset means: a chart drawn from this, or a consistency finding
//         raised by it, has to be reproducible against the version that ran.
//
//         Extraction NEVER edits a note. It returns spans into the input and
//         values from controlled tables, so the meaning-preservation contract
//         in standardize.ts is untouched by construction. Negation is assigned
//         (the algorithm measures 97/97); temporality is only ever hinted (67%
//         recall on "historical" is below this product's bar for deciding).
// 2.10.0 — the parser learns the rest of a note. Measured against a corpus of
//         real shorthand it read 26.2% of clauses; it now reads 94.6%, and
//         coverage.test.ts ratchets that so it cannot regress quietly.
//
//         New fact kinds: medication (with dose, concentration, and carpule-to-
//         millilitre arithmetic where the convention is exact), measurement
//         (including ranges and blood pressure), finding, material, care-event.
//         New controlled vocabulary: vocab/clinical-terms.ts, plus operative
//         steps in vocab/procedures.ts.
//
//         Two defects the corpus caught that inspection had not:
//         "no caries noted" was in the pseudo-trigger list, so every clean exam
//         reported caries; and chart.ts kept a private copy of the site
//         accessor, so the day findings started carrying teeth, a negated
//         finding stopped reaching the chart at all.
//
//         impliesNegation exists for NKA/NKDA. Reading an absence of allergy as
//         an allergy is the most dangerous inference available to this parser,
//         so the term's own meaning overrides surrounding cues rather than
//         combining with them.
// 2.11.0 — the tiered shorthand filing gate (audit/rules/shorthand-gate.ts).
//         Ambiguous shorthand, shorthand no table can read, and Joint
//         Commission / ISMP do-not-use constructs now raise S1 and stop FILING.
//         Shorthand the tables can already expand is untouched and still costs
//         the writer nothing, because a gate that stops "BW" and "10U" with the
//         same force teaches people to clear both with the same reflex.
//
//         Four false positives found by the existing suite while building it,
//         each of which would have been enough on its own to get the gate
//         switched off: units of measurement ("5 mm" blocked a note for
//         containing a millimetre), Roman numerals ("ASA II"), the tool's own
//         PHI masks (blocking a note BECAUSE it had been redacted), and
//         alphanumeric terms truncated at the first digit ("ETCO2" reported as
//         "ETCO"). All four are now pinned regression tests.
//
//         New controlled vocabulary: ETCO2, SpO2, ECG/EKG, NIBP. The sedation
//         module's own labels were rewritten to define ASA and ETCO2 on first
//         use, because the app failing its own gate is a real finding.
export const RULESET_VERSION = "2.11.0";
