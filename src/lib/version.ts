// The single source of truth for the deterministic ruleset version. It is
// stamped onto every submission and audit report and frozen into the
// submissions record, so a later change to the rules never silently rewrites
// what a past note was audited against. Bump on any change to audit rules,
// module definitions, or controlled vocabulary.
// 2.1.0 — plural-preserving first-use shorthand expansion (pluralExpansion):
//         "SSCs" no longer expands to a singular; counts survive.
// 2.2.0 — the patient-experience layer. All three triggers above fired at once
//         and the bump was missed at merge time, which is worth recording
//         because it is the exact failure this constant exists to prevent: two
//         notes stamped 2.1.0 could have been audited by different rules.
//         Audit rules: the plain-language rule set, the "plain-language"
//         category, and the suppression of STYLE abbreviation findings inside
//         patient-facing text. Module definitions: the anxiety-comfort module,
//         the "Written for the patient" and "Open items" sections, and the
//         telephone and portal encounter types. Vocabulary: PLAIN_WORDS, the
//         quadrant and s/s shorthand, four lexicon words, and a widened
//         vague.moderate carve-out.
export const RULESET_VERSION = "2.2.0";
