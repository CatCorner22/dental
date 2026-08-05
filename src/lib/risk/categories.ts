// FAILURE-MODE TAXONOMY: what goes wrong in a record, as opposed to what kind of
// check noticed it.
//
// The audit already has an `AuditCategory` (see audit/types.ts) and it is doing a
// different job. That one is a DETECTOR taxonomy — phi, spelling, measurement,
// anatomy — and it answers "which mechanism fired". This one is a FAILURE
// taxonomy and answers "what does this defect do to a record months later".
//
// The two are orthogonal, and the absence of the second was costing something
// concrete. `complete.extraction-no-outcome` and `complete.consent-no-decision`
// are both declared `category: "required"`, which is also the category of "this
// text box is empty". Five rules derived from real documentation-failure research
// were therefore indistinguishable, in the type system, from a blank field. With
// only the detector taxonomy there is no question you can ask the code that
// returns "this failure mode has nothing covering it" — the gap is not
// representable, so it cannot be managed.
//
// INTERNAL FRAMING: this module is the spine of the language optimizer for risk
// reduction. It is deliberately NOT user-facing vocabulary. Nothing here claims a
// note is defensible, compliant, or safe from a claim, and no screen should say so
// on the strength of it. What a category legitimately supports is the far smaller
// statement in `whatAReaderNeeds`: what someone reading this record later will be
// unable to work out if the defect stands.
//
// WHY A TAXONOMY RATHER THAN A CLASSIFIER. The obvious alternative is to train a
// model to sort notes into these buckets. It was considered and rejected for this
// position in the stack: a probabilistic gate fails differently for different
// users, which is precisely what standard work forbids; a rule can cite itself and
// a score cannot; a classifier that is mostly right absorbs its own misses
// invisibly, whereas an uncategorized failure mode is loudly missing; and the only
// legal training corpus here is synthetic, so a model trained on it would learn
// this project's assumptions and then be cited as evidence for them. The taxonomy
// stays deterministic. It may bound what an optional assist is allowed to ASK —
// a finite question set per category — but it never decides.

/**
 * The finite set. Adding one is a deliberate act, and the exhaustiveness test in
 * `categories.test.ts` means adding a RULE without placing it here fails the build.
 */
export type RiskCategoryId =
  | "identifier-exposure"
  | "wrong-referent"
  | "material-omission"
  | "rationale-absent"
  | "ambiguity"
  | "record-mechanics"
  | "author-voice"
  | "medication-safety";

export interface RiskCategory {
  id: RiskCategoryId;
  /** Internal label. Not screen copy. */
  label: string;
  /** What the defect actually looks like in a note. */
  defect: string;
  /**
   * What a later reader cannot work out while the defect stands.
   *
   * This is the ONLY claim in this file that is safe to paraphrase on a screen,
   * because it is a statement about reading comprehension rather than about legal
   * outcomes. "A reader cannot tell which tooth" is verifiable. "This protects you"
   * is not, and must never be derived from it.
   */
  whatAReaderNeeds: string;
}

export const RISK_CATEGORIES: readonly RiskCategory[] = [
  {
    id: "identifier-exposure",
    label: "Identifier exposure",
    defect: "Text that could identify a patient reached a tool that is de-identified by construction.",
    whatAReaderNeeds:
      "The de-identification premise of this record holds only if no identifier is present."
  },
  {
    id: "wrong-referent",
    label: "Wrong referent",
    defect:
      "The note points at something other than what was treated — an impossible tooth number, a surface that does not exist on that anatomy, mixed dentitions, a notation system this practice does not use.",
    whatAReaderNeeds: "Which tooth, which surface, which arch — without inference."
  },
  {
    id: "material-omission",
    label: "Material omission",
    defect:
      "Something the visit produced is simply not in the note: an agent given without its amount, an image taken without its reading, an extraction without its outcome, a consent conversation without its decision, a prescription without its duration.",
    whatAReaderNeeds:
      "The facts the visit generated, in the note, rather than in the memory of whoever was in the room."
  },
  {
    id: "rationale-absent",
    label: "Rationale absent",
    defect: "What was done is recorded; why it was indicated is not.",
    whatAReaderNeeds:
      "The reasoning that made this the right treatment, which no later reader can reconstruct from the procedure name."
  },
  {
    id: "ambiguity",
    label: "Ambiguity",
    defect:
      "Wording that a later reader can take more than one way — private shorthand, an abbreviation with two meanings, a vague quantifier, a misspelled drug name, a unit that does not match its measurement.",
    whatAReaderNeeds: "One reading, not two."
  },
  {
    id: "record-mechanics",
    label: "Record mechanics",
    defect:
      "The defect is in when or how the entry was made rather than in what it says: an unresolved placeholder, text carried forward from a previous visit, a duplicated sentence, an entry made well after the encounter without being labelled as one.",
    whatAReaderNeeds:
      "Confidence that the entry describes THIS visit and was made when it says it was."
  },
  {
    id: "author-voice",
    label: "Author voice",
    defect:
      "The note characterizes the patient or the staff instead of documenting the visit — judgement, blame, or filler standing where an observation belongs.",
    whatAReaderNeeds:
      "What was observed and done, in terms the person described could read without being characterized."
  },
  {
    id: "medication-safety",
    label: "Medication safety",
    defect:
      "A drug pairing, a dose that does not reconcile with its own arithmetic, or a unit muddle that a second reader should see before it reaches a patient.",
    whatAReaderNeeds:
      "A flag in front of a human. This tool never computes, converts, or suggests a dose."
  }
];

export const RISK_CATEGORY_BY_ID: Record<RiskCategoryId, RiskCategory> = Object.fromEntries(
  RISK_CATEGORIES.map((c) => [c.id, c])
) as Record<RiskCategoryId, RiskCategory>;

/**
 * Every rule the engine can emit, placed in exactly one failure category.
 *
 * A trailing "." marks a FAMILY: `medsafe.interaction.` covers every id the
 * interaction table composes at runtime, which are the only dynamic rule ids in
 * the engine. Families are matched by prefix, exact ids by equality, and exact
 * always wins.
 *
 * One category per rule, on purpose. A rule that genuinely belongs in two is a rule
 * doing two jobs, and splitting it is the better fix than blurring the taxonomy.
 */
export const RULE_RISK_CATEGORY: Record<string, RiskCategoryId> = {
  // ── identifier exposure ────────────────────────────────────────────────────
  "phi.": "identifier-exposure",

  // ── wrong referent ─────────────────────────────────────────────────────────
  "anatomy.invalid-tooth": "wrong-referent",
  "anatomy.mixed-dentition": "wrong-referent",
  "anatomy.surface-orphan": "wrong-referent",
  "anatomy.text-surface-stop": "wrong-referent",
  "anatomy.text-tooth": "wrong-referent",

  // ── material omission ──────────────────────────────────────────────────────
  // The five completeness rules are the ones the detector taxonomy could not
  // distinguish from an empty text box. This is the distinction.
  "complete.anesthetic-no-amount": "material-omission",
  "complete.consent-no-decision": "material-omission",
  "complete.extraction-no-outcome": "material-omission",
  "complete.imaging-no-interpretation": "material-omission",
  "complete.rx-no-duration": "material-omission",
  // Arrived with the claim-file research on main, and the exhaustiveness test
  // demanded them before the merge could land — which is the taxonomy working
  // rather than a chore. A consent line thin enough to be checkbox theatre and a
  // referral whose loop never closes are both facts the visit produced that the
  // note does not carry.
  "complete.consent-thin-assertion": "material-omission",
  "complete.referral-loop-open": "material-omission",
  // Open clinical loops from the deep-research ingest: a finding or procedure
  // without the next disposition is a fact the visit produced that the note
  // never carries — same failure mode as an extraction without an outcome.
  "complete.finding-no-disposition": "material-omission",
  "complete.procedure-no-followup": "material-omission",
  "required.missing": "material-omission",
  "supervision.pc1107-new-patient": "material-omission",
  "supervision.pc1107-unanswered": "material-omission",

  // ── rationale absent ───────────────────────────────────────────────────────
  // The general case main added beside the three procedure-specific rules: a
  // procedure recorded with no reasoning attached. This was the thinnest
  // category in the taxonomy when it was written, and it is now less thin.
  "complete.clinical-rationale": "rationale-absent",
  // Drug named; clinical why omitted — same reader gap as a procedure without
  // reasoning. Duration alone is already covered by complete.rx-no-duration.
  "complete.rx-no-indication": "rationale-absent",
  "justify.buildup-retention": "rationale-absent",
  "justify.crown-necessity": "rationale-absent",
  "justify.srp-periodontal-evidence": "rationale-absent",

  // ── ambiguity ──────────────────────────────────────────────────────────────
  // Every one of these is a note that can be read two ways. `gate.do-not-use.` is
  // the strictest of them and the one with the clearest evidence behind it: the
  // abbreviations on it are there because they have been misread in practice.
  "gate.unknown-shorthand": "ambiguity",
  "gate.ambiguous.": "ambiguity",
  "gate.do-not-use.": "ambiguity",
  "abbrev.": "ambiguity",
  "vague.": "ambiguity",
  "plain.": "ambiguity",
  "spelling.unknown-word": "ambiguity",
  "measurement.range": "ambiguity",
  "measurement.unit": "ambiguity",

  // ── record mechanics ───────────────────────────────────────────────────────
  // `stale.` is copy-forward: text that belongs to a previous visit and is being
  // filed as though it describes this one.
  "residue.": "record-mechanics",
  "stale.": "record-mechanics",

  // ── author voice ───────────────────────────────────────────────────────────
  "effort.gibberish": "author-voice",
  "effort.unprofessional": "author-voice",
  "stigma.": "author-voice",

  // ── medication safety ──────────────────────────────────────────────────────
  "medsafe.": "medication-safety",
  "dose.anaesthetic-max.": "medication-safety"
};

/** Which failure category does this rule id belong to? Exact id beats family prefix. */
export function categoryOf(ruleId: string): RiskCategoryId | null {
  const exact = RULE_RISK_CATEGORY[ruleId];
  if (exact) return exact;
  for (const [key, category] of Object.entries(RULE_RISK_CATEGORY)) {
    if (key.endsWith(".") && ruleId.startsWith(key)) return category;
  }
  return null;
}

export interface CategoryCoverage {
  category: RiskCategory;
  /** Rule ids and families placed in this category. */
  rules: string[];
}

/**
 * Coverage, per failure mode — the question the detector taxonomy could not answer.
 *
 * An empty `rules` array is the useful output: it is a failure mode this tool
 * currently does nothing about, stated as a fact rather than discovered when
 * somebody needs the note.
 */
export function coverageByCategory(): CategoryCoverage[] {
  return RISK_CATEGORIES.map((category) => ({
    category,
    rules: Object.entries(RULE_RISK_CATEGORY)
      .filter(([, id]) => id === category.id)
      .map(([rule]) => rule)
      .sort()
  }));
}
