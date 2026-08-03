# Cornerstone Dental Arts — practice profile and Curve Hero standardization

- **Source**: "Standardizing Clinical Documentation and Patient Notes at Cornerstone Dental Arts" (user-supplied report)
- **Type**: report
- **Author/Origin**: Commissioned research, supplied by the project owner
- **Published**: 2026
- **Ingested**: 2026-08-03
- **Tags**: dental, pms, clinical-notes, note-templates, benchmarking, tennessee, compliance, deployment

## Summary

The first description of the **actual deployment target**. Cornerstone Dental Arts is a
three-office practice in Knoxville, Tennessee — Town & Country Circle (flagship, five doctors),
Executive Park (cosmetic and facial aesthetics), Fort Sanders West (restorative and surgical) —
with ~30 employees and an estimated $6.5M annual revenue, running Curve Hero. Everything Smile
Notes had been built against until now was a generic research view of dental documentation; this
report is the shape the product actually has to fit.

## Key concepts

- **Three offices, one practice.** Locations differ in clinical emphasis: Town & Country is
  comprehensive multi-provider; Executive Park leans cosmetic, facial aesthetics and emergency;
  Fort Sanders West does advanced restorative and surgical with early-morning hours.
- **Roles present in the building**: doctors, hygienists, assistants, coordinators — i.e. the
  clinical-role distinction Tennessee law turns on is a real staffing fact here, not a hypothetical.
- **Services offered** that map to note modules: family/general, cosmetic (veneers, whitening,
  smile makeovers), facial aesthetics, restorative, implants, bone grafting, surgical extraction,
  orthodontics and clear aligners, pediatric, **sleep apnea**, **TMJ/TMD**, sedation (nitrous, oral,
  IV), and emergency same-day care.
- **The practice's own approved abbreviation dictionary** (15 terms): BOP, BWX, FMX, PPD, SRP, LA,
  N2O, MOD, RCT, Tx, CC, NKA, NKDA, Rx, POI — with an explicit do-not-use list: U (units), Q.D.,
  Q.O.D., IU.
- **NKA and NKDA appear as separate approved entries**, which independently corroborates the
  transformer fix that stopped rewriting one as the other.
- Curve Hero specifics: Note Templates module with reusable questions and conditional logic,
  multi-code shortcut buttons, and Curve Care+ ambient AI note capture. Multi-location practices
  get centralized template management and role-based access.
- Recommends transformer scripts/macros that auto-populate note sections from dropdown selections
  (e.g. selecting a crown prep fills tooth, material, shade, impression, temp, post-op).

## Notable quotes and data

> "Records for minors must be retained for the period of minority plus one year or **ten years**
> following the last date of service, whichever is longer." — §1.2, citing the TN Department of
> Health Standards of Practice Manual

- Founded 1988; 30+ employees; ~$6.5M estimated annual revenue.
- Knoxville market: top practices average 368 reviews at 4.59 stars; 42% spam rate among top-3
  local-pack results.
- Claims luxury amenities raise case acceptance 15–45% and patient acquisition 18–60% within 18
  months (vendor-sourced figure — treat with caution).

## Relationships

- **Agrees with** [Curve Hero PMS benchmark](curve-hero-pms-clinical-documentation.md) on the
  platform's template/QuickText model and the copy-paste integration assumption.
- **Agrees with** [the Tennessee note-standardization research](tn-dental-note-standardization-curve-hero.md)
  on dentist-owned diagnosis and role separation.
- **Contradicted, then resolved, on retention** — see the legal-best-practices source, which shows
  the ten-year figure here is the *minors* rule from a different authority, not a general adult
  rule. This report states it without that qualification, which is what produced the apparent
  conflict.
- **Exceeds the app**: no location concept exists in Smile Notes at all, so a filed note cannot
  record which of the three offices produced it.

## Raw notes

Most of this report is not software: marketing benchmarks, amenity ROI, staff training curricula,
governance committees, rollout plans. The software-relevant deltas are multi-office support, the
approved abbreviation dictionary and its do-not-use list, and the missing sleep-apnea / TMJ-TMD /
cosmetic modules.
