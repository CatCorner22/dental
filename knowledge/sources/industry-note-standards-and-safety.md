# USA industry note standards, prescription safety, and litigation patterns

- **Source**: Web research compiled 2026-08-03 from ADA Guidelines for Practice Success
  (records/templates/SOAP pages and tip sheet), AAPD recordkeeping best-practice policy,
  ISMP error-prone abbreviation list (2024 revision) + Joint Commission "Do Not Use"
  (IM.02.02.01) and Sentinel Event Alert 39, AHRQ PSNet "A Weighty Mistake", pediatric
  dosing literature (J Clin Pediatr Dent; Emergency Physicians Monthly), SDCEP Drug
  Prescribing for Dentistry drug-interaction appendix, peer-reviewed "Three Serious Drug
  Interactions that Every Dentist Should Know About", WSDA risk-management case study,
  Dentist's Advantage / CNA claim files, Curve Dental Zendesk documentation.
- **Type**: research synthesis for rule design
- **Ingested**: 2026-08-03
- **Tags**: dental, clinical-notes, compliance, medication-safety, litigation, ISMP,
  ADA, AAPD, curve-hero, benchmarking

## Structure standards (ADA / AAPD)

- Records must be objective, clinical in tone, and specific to the patient; SOAP
  (Subjective, Objective, Assessment, Plan) is the ADA-suggested completeness scaffold.
- **Templates are endorsed with a warning**: they increase compliance, but cloned,
  uncustomized entries raise audit and liability risk. Entries should specify
  tooth-by-tooth and procedure-by-procedure detail. Smart phrases should always be
  accompanied by individualized data and reviewed by counsel or the liability carrier.
- Abbreviations only when standardized for the practice with a shared key (the WordMap
  and `/reference/abbreviations` serve this role in Smile Notes).
- Corrections are append-only: never obliterate; separate clarifying entries for
  electronic records (AAPD).

## Prescription and measurement safety

- **The kilogram rule**: the most common weight-based dosing error is pounds treated as
  kilograms (a 2.2× overdose). Joint Commission Sentinel Event Alert 39 and ISMP call
  for kilograms as the standard nomenclature on prescriptions, records, and staff
  communication. → `medsafe.lb-with-mg-per-kg` (S1) and mixed-unit rules.
- Tenfold errors from misplaced decimals/trailing zeros; naked decimals prohibited
  (JC Do Not Use). → existing `plausibility.ts` dose-designation rails.
- Household spoons vary ~2× in delivered volume; mL + oral syringe is the standard for
  liquid pediatric medication. → `medsafe.household-units` (S2).
- Including the mg/kg basis on the prescription enables independent double-checking.
  → `medsafe.dose-does-not-reconcile` (S1) checks that weight × basis and total agree
  within a generous envelope, without ever stating the expected value.

## Dental drug interactions (SDCEP + dental pharmacology literature)

The short list that dental prescribing actually produces, encoded flag-only in
`medication-safety.ts` (both agents must appear; avoidance cues downgrade):

| Pair | Documented harm |
|---|---|
| warfarin × metronidazole / azoles (incl. topical miconazole) | CYP2C9 inhibition → INR spikes, serious bleeding |
| anticoagulant × NSAIDs | compounded bleeding risk |
| warfarin × doxycycline / macrolides | INR elevation, monitoring needed |
| NSAID × lithium | reduced renal clearance → lithium toxicity |
| NSAID × methotrexate | reduced clearance |
| epinephrine × non-selective beta-blockers (propranolol) | hypertensive reaction + reflex bradycardia; literature ceiling 0.034 mg epinephrine |
| statins × macrolides / azoles | myopathy |
| metronidazole × alcohol | disulfiram-like reaction (advise avoidance) |
| NSAID × SSRIs / corticosteroids / asthma | GI bleeding / ulceration / bronchospasm |

## Litigation patterns (public risk-management sources)

See **`litigation-documentation-research.md`** for the full epistemic frame, quantitative
Doctors Company cohort data, case-pattern themes, and rule mapping table. Summary:

- "If it wasn't written down, it didn't happen" — sparse entries ("RCT complete #30
  with local") leave the defense unable to reconstruct findings, consent, anesthetic,
  technique, or reasoning years later (WSDA case study).
- Recurring fatal gaps in claim files: undocumented radiographic findings, missing
  signed/discussed consent, missing progress detail, missing complications statement,
  missing materials. → the anticipatory `completeness.*` rules and the verified blocks.
- The practical bar: another dentist should understand exactly what took place from the
  note alone, with no conversation.

## Curve Hero (destination) — current documentation

- Note Templates live in Curve Forms (Questions → Templates), with required fields that
  block saving; templates attach via Sidekick; Treatment Planning notes auto-convert to
  Clinical History at checkout.
- Curve is shipping AI SOAP / AI templated notes from ambient recordings, always with
  human review before save. Smile Notes' differentiation is enforcement and provable
  meaning-preservation, plus a de-identified posture Curve's ambient recording cannot
  offer.
- Integration remains copy-paste plain text; the two-identifier paste confirmation
  implements the TN research recommendation at the handoff.

## How this maps into code

| Guidance | Implementation |
|---|---|
| SOAP scaffold | AI `soap` capability (Safety first per TN research) |
| Template customization warning | verified blocks carry `<placeholders>` the residue rule blocks until replaced |
| Kilogram rule | `medsafe.lb-with-mg-per-kg`, `medsafe.mixed-weight-units` |
| Do-not-use dose designations | `plausibility.ts` + `dose-safety.test.ts` |
| Interaction list | `medsafe.interaction.*` |
| Deposition completeness | `completeness.*` + AI `interrogate` |
| Objective tone | `effort.unprofessional` + stigmatizing rules |
