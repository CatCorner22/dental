# Legal Best Practices for Dental Office Patient Notes (Cornerstone, Knoxville TN)

- **Source**: "Legal Best Practices for Dental Office Patient Notes: A Comprehensive Guide for Cornerstone Dental Arts" (user-supplied report)
- **Type**: report
- **Author/Origin**: Commissioned research, supplied by the project owner
- **Published**: 2026
- **Ingested**: 2026-08-03
- **Tags**: dental, clinical-notes, tennessee, compliance, legal, hipaa, consent, audit, note-templates

## Summary

The legal counterpart to the practice profile: Tennessee Board of Dentistry recordkeeping rules,
2026 HIPAA Security Rule changes, SOAP structure, informed consent, the Joint Commission
abbreviation prohibitions, chart audits, and patient-rights workflows. **Its most valuable
contribution to this project is resolving a retention discrepancy that looked like a legal
conflict and was actually a category error.**

## Key concepts

- **THE RETENTION RESOLUTION.** Two prior sources appeared to disagree (7 vs 10 years). They do
  not:
  - **Adults: seven years** from last professional contact, Tenn. Comp. R. & Regs. 0460-02-.12.
    Three independent sources now agree, and it is what the app already stated.
  - **Minors: the ten-year figure belongs only here**, and comes from a *different authority* — the
    TN Department of Health Standards of Practice Manual (minority + 1 year, or ten years from last
    service, whichever is longer). The Board rule's minor floor is seven years.
  - So the residual discrepancy is narrow and specific to minors. Taking the longer period
    satisfies either reading; taking seven does not.
- **Joint Commission "Do Not Use" list**, reproduced in full: `U`/`u` → unit; `IU` → International
  Unit; `Q.D.`/`QD` → daily; `Q.O.D.`/`QOD` → every other day; trailing zero (`X.0 mg`) → `X mg`;
  **lack of leading zero (`.X mg`) → `0.X mg`**; `MS`/`MSO4`/`MgSO4` → write the full drug name.
- **2026 HIPAA Security Rule Final Rule** removes the "addressable" loophole: MFA mandatory for all
  ePHI access, encryption mandatory at rest and in transit, documented asset inventory, annual
  security risk analysis, BAAs must name specific security controls, tested incident-response plan.
- **Corrections**: single line through the error, "CID" notation, initials, and date. Never
  white-out, never erasure. Electronic amendments must preserve the original.
- **Minors and consent**: Tenn. Code § 63-1-176 requires parental consent, with exceptions for
  emancipated minors, mature minors (14–18) by provider judgement, and emergencies. Record the
  identity and relationship of the consenting adult.
- **Photography** requires consent for clinical use and *separate explicit* consent for marketing,
  education, or publication.
- **Record transfer on retirement, sale, or death**: notify patients seen in the preceding 36
  months within 30 days; abandonment is a violation.
- **21st Century Cures Act** gives patients routine access to their notes, so documentation should
  use plain-English, person-first, non-stigmatizing language ("prefers not to" rather than
  "non-compliant"; "person with diabetes" rather than "diabetic").
- Chart audits: 5–10% of records monthly or quarterly, with documented findings and remediation.

## Notable quotes and data

> "Lack of leading zero (.X mg) → 0.X mg" — §5.1, Prohibited Abbreviations table

> "Instead of: 'Pt. non-compliant with OHI, poor prognosis.' Use: 'The patient reports brushing
> once daily. We discussed the benefits of brushing twice daily and flossing…'" — §7.1

- Patient record copies due within **ten working days** of a written request (Tenn. Code § 63-2-101).
- HIPAA penalties up to **$50,000 per violation**.
- Tennessee breach notification: **45 days** (shorter than HIPAA's 60).

## Relationships

- **Resolves** the apparent contradiction between
  [the TN note-standardization research](tn-dental-note-standardization-curve-hero.md) (7 years) and
  [the Cornerstone practice profile](cornerstone-dental-arts-practice-profile.md) (10 years). See
  above: different authorities, different populations.
- **Independently confirms** the dose-safety gaps found by adversarial testing on 2026-08-03. Its
  prohibited-abbreviation table is item-for-item what the app was failing to detect — `U`, `IU`,
  `MS`/`MSO4`/`MgSO4`, trailing zeros, and the naked leading decimal that a live probe showed was
  not merely undetected but actively mangled ("Midazolam .5 mg" → "Midazolam.5 mg", and the
  plausibility checker misquoting ".50000 mg" as "50000 mg"). All fixed in Phase 0.
- **Agrees with** the TN research on dentist-owned diagnosis, append-only amendment, and separating
  entry author from clinical performer.
- **Exceeds the app**: HIPAA 2026 operational controls (MFA, encryption at rest, SRA, asset
  inventory, BAA tracking, incident response, 45-day breach notification) are documented nowhere in
  the repo. Most are practice operations rather than app features, but MFA and encryption at rest
  are partly app-side.

## Raw notes

The stigmatizing-language guidance is directly actionable: the app already has `VAGUE_PHRASES` and
`STALE_PHRASES` with an established shape, so a `STIGMATIZING_PHRASES` list drops in alongside them
— flagged, never auto-applied, since rewording a clinician's judgement is exactly the kind of call
the tool must not make unilaterally.
