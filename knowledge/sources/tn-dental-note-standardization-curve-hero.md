# Standardizing Tennessee Dental Patient Notes for Curve Hero

- **Source**: f4704dd1-deepresearchreport.md (uploaded deep-research report)
- **Type**: paper
- **Author/Origin**: Commissioned deep research, prepared for the Smile Notes project
- **Published**: 2026 (undated in document)
- **Ingested**: 2026-08-03
- **Tags**: dental, clinical-notes, tennessee, compliance, legal, note-templates, transformer, audit, benchmarking, rbac

## Summary

Operational and legal research on what a Tennessee dental record must contain, and what a
note-standardizing transformer may and may not do to it. Tennessee imposes **outcome-oriented**
requirements rather than a mandatory SOAP order: the record must let a later dentist reconstruct
the basis for diagnosis, plan, outcomes, and continuity of care. The report's central design claim
is that the right architecture is not a "note beautifier" but a **role-aware, provenance-preserving
transformer** that refuses to invent facts. Explicitly *not* a legal opinion — it recommends review
by Tennessee dental counsel and the practice's liability carrier before deployment.

Directly relevant to Smile Notes because it supplies the legal grounding for the deterministic,
never-guess posture the transformer already takes, and because it names several controls the app
does not yet implement (clinical-role separation, dentist review event, amendment chain).

## Key concepts

- **No mandatory note order in Tennessee.** The state prescribes no SOAP sequence and no required
  ordering of assistant-versus-hygienist entries. The recommended order in the report is a
  conservative design derived from TN's continuity standard plus the more explicit rules of
  Washington, Texas, California, and Florida — not a TN statutory mandate.
- **Minimum TN record content**: tooth-condition charting; concise description and date of every
  service; concise medical history; dates/types/amounts of pharmaceuticals; readable radiographs
  when required. X-rays *and their interpretations* are both record components.
- **Three identities that dental software habitually blurs**, and that should be stored separately:
  **entry author** (who typed it), **clinical performer** (who did it), **responsible/reviewing
  dentist** (who diagnosed, planned, or affirmed). A dentist's review must be a separate event, not
  an overwrite of staff attribution.
- **Scope-of-practice is a hard constraint on the transformer.** Tennessee hygienists may collect
  findings *for diagnosis by the dentist* but may not independently perform comprehensive
  examination, diagnosis, or treatment planning. Assistants may not exercise dentist professional
  judgment. So a transformer must not convert a staff observation into a diagnosis.
- **The transformer MAY**: standardize capitalization/punctuation, expand approved abbreviations,
  reorder supplied facts into the schema, convert explicit dates/units/tooth/surface notation,
  remove exactly-duplicative statements while retaining provenance, place observations under the
  correct role, and identify missing/conflicting/out-of-scope fields.
- **The transformer MUST NOT**: infer a diagnosis; supply a radiographic interpretation; infer that
  consent occurred or that a dentist examined the patient; infer a procedure, material, anesthetic
  quantity, prescription, code, complication status, or follow-up; change the named performer; make
  an unsigned note look signed; convert a late entry into a contemporaneous one; erase contradictory
  source information; or emit a final note while a critical conflict is unresolved.
- **Blocking validation rules** (note must not be released for paste): patient-identity mismatch,
  missing date of service, unresolved performer, out-of-scope source (assistant-entered definitive
  diagnosis), unattributed radiographic finding, medication incompleteness, conflicting tooth or
  surface, consent contradiction, impossible chronology, amendment without original reference,
  unresolved template placeholder, missing required dentist review.
- **Append-only amendments.** TN's dental rule has no detailed electronic correction syntax, but the
  absence of a format is explicitly *not* a licence to overwrite silently. Preserve the original,
  label the correction, state its reason, identify the author, use the actual correction time, link
  it to the original encounter. Florida requires strike-through rather than removal; Washington
  requires a time-and-date history of edits to signed records.
- **Safety information precedes invasive treatment** in the recommended ordering: medical-history
  changes, allergies, medications, alerts, and vitals come before diagnostic conclusions and
  procedures.
- **Subjective must stay attributed.** "Patient reports pain for three days" is preferred over
  "Tooth has been painful for three days" — the transformer must not promote a patient statement to
  an established fact.
- **Free text is the least authoritative input.** Where structured and narrative inputs conflict,
  the system should raise a blocking conflict rather than silently pick one.
- **Curve Hero integration is copy-paste, not API.** The report assumes no documented Curve Hero
  API and targets stable UTF-8 plain text with ordinary line breaks, short stable headings, no
  hidden formatting, and no unverified Curve-specific markup.

## Notable quotes and data

> "a transformer must not convert a staff observation such as 'dark area distal #30' into 'distal
> caries #30' unless the diagnosis was expressly supplied or approved by a dentist." — TN baseline,
> dentist-only judgment

> "Four bitewings acquired by RDA" is not an interpretation. — Ordering rules

> "Allergies: No known drug allergies, as reported by patient." — Restorative encounter sample
> template (note the source attribution carried alongside the negative)

- **Retention**: at least **seven years** from last professional contact; indefinite for an
  incompetent patient; for a minor, the longer of seven years or one year past majority. No record
  in a current dispute may be destroyed.
- **Patient access**: full copy within **ten working days** of a written request; a summary does not
  substitute. Electronic records must be provided electronically on request.
- **Comparative retention**: WA 6 years, TX 5 years (or to age 21 for minors), FL 4 years.
- Recommended audit event types include `TRANSFORMATION_RUN` (ruleset + template versions, input
  and output hashes), `DENTIST_REVIEWED`, `FINAL_APPROVED` (final hash), `CURVE_PASTE_CONFIRMED`
  (identifiers checked), and `AMENDMENT_ENTERED` (actual time, original reference).
- The interface "should require the user to match at least two patient identifiers against the open
  Curve chart before confirming the paste."

## Relationships

- **Agrees with**
  [Curve Hero PMS benchmark](curve-hero-pms-clinical-documentation.md): both treat Curve Hero
  integration as template-and-paste rather than API, and both point at Curve Forms / QuickText as
  the target text shape.
- **Agrees with the app's existing deterministic posture.** The MUST-NOT list is almost exactly the
  rule the transformer already follows (never compute or suggest a dose; flag rather than guess).
  It supplies the legal grounding that was previously only a design preference.
- **Contradicts nothing already filed**, but **exceeds the app's current implementation** in four
  places worth tracking:
  1. **Clinical roles are absent.** The app's roles (`readonly`/`user`/`lead`/`manager`/`admin`) are
     administrative, not clinical. There is no assistant/hygienist/dentist distinction and so no
     enforcement of "diagnosis is dentist-owned".
  2. **No dentist-review event.** Submissions freeze an entry author (`submittedByName`) but there
     is no separate reviewing-dentist affirmation.
  3. **No amendment chain.** Submissions are immutable and never rewritten (good), but there is no
     first-class addendum/correction linked to an original.
  4. **No retention or destruction policy** is documented or implemented for the seven-year rule.
- **Note on scope**: the app is PII-free by design for day 1, which sidesteps much of the HIPAA
  surface the report covers (patient identifiers, BAA analysis, disclosure logs). Those controls
  become live only if the practice ever decides to put identified data in, which the on-screen
  notice currently forbids.

## Raw notes

Actioned in this session as a direct result of reading this report: the transformer's clinical
meaning-change defects (NKA silently rewritten as NKDA, FMS as FMX, Coe-Pak as a billable
comprehensive oral evaluation, plurals collapsed so two joints became one) are all instances of the
report's MUST-NOT list, and were fixed. The safety block (allergies / medications / medical-history
changes / premedication, each with a separate confirmation when the answer is a negative) implements
"safety information precedes invasive treatment" plus the report's insistence that a negative be a
verified statement rather than a default.
