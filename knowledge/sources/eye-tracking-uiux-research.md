# Eye tracking, web-app usability, and cognitive design — research report

- **Source**: "Eye Tracking, Web-App Usability, and Cognitive Design for Native-Born U.S. Residents" (owner-supplied deep-research report)
- **Type**: research synthesis + Cursor Skill specification
- **Ingested**: 2026-08-04
- **Owner's framing at ingestion**: "consider for note templates. No changes needed. Just some ideas." — ingested as ideas; no template changes made.
- **Operationalized as**: `.cursor/skills/ui-and-ux-inspection/` (the report's own skill specification, preserved verbatim)

## Summary

An evidence-tiered synthesis of eye-tracking and HCI research for English-language,
left-to-right web interfaces, with an unusually honest headline limitation: published
eye-tracking research almost never identifies participants by U.S. nativity, so no
"native-born gaze pattern" can be defended. What the evidence does support: users scan
before reading; early attention goes to upper-left in conventional layouts; the F-pattern
is a symptom of weakly structured text, not a design target; descriptive headings produce
layer-cake scanning; semantically rich content can redirect gaze (Google Knowledge Graph
study: right-region dwell <1% → ~13%). The most damaging app defects are goal mismatches,
not aesthetics: weak signifiers, premature data requests, late validation, hidden status,
inconsistent terminology, unrecoverable errors.

## Ideas relevant to note templates (the owner's stated lens)

None of these were implemented; recorded for the next template revision:

1. **Layer-cake scanning favors descriptive headings.** Template section labels should
   carry meaning ("RECOMMENDATIONS / CONSENT / REFUSAL" already does; bare "Details" or
   "Information" would not). The DES-12 scaffolds already comply; keep the discipline.
2. **Front-loaded labels.** In field labels and table rows, the differentiating word
   belongs first — staff scanning a template under time pressure read left edges.
3. **Progressive disclosure over deletion.** Rarely used template fields (lab lot
   numbers, interpreter details) are candidates for disclosure-on-relevance rather than
   removal — simplify the default path without losing the legal completeness.
4. **Backward tracing as template QA.** The report's method — start from the successful
   end state (a filed, defensible note) and mark each field essential / inferable /
   deferrable / removable — is a repeatable audit for every template the practice adds.
5. **Recognition over recall.** Templates outperform free text precisely because they
   convert recall into recognition; the report's evidence base justifies the app's
   existing template-first posture.

## What the report contributes beyond templates

- A complete, internally consistent **UI and UX Inspection skill specification**
  (severity/confidence models, finding schema, 20-heuristic catalog, WCAG 2.2 AA
  procedure, privacy and eye-tracking controls) — installed verbatim as a project skill.
- **Population-claim discipline**: never infer nativity, disability, age, or literacy
  from behavior or language; subgroup analysis requires direct, optional self-report.
  This matches the practice's existing prohibited-assumptions posture.
- **Metric discipline**: task outcomes before clicks; numerical targets are proposed
  experiment gates until measured. Consistent with the app's "no invented percentages"
  rule.

## Caveats adopted

The report's step-reduction figures (44–50%) are illustrative redesign targets, not
measured effects, and it says so; that framing is preserved wherever the skill is used.
