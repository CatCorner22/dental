---
name: standardize-dental-notes
description: Draft, normalize, audit, or convert de-identified U.S. dental clinical notes and reusable note templates. Use for examinations, imaging, preventive, restorative, endodontic, periodontal, prosthodontic, implant, orthodontic, pediatric, oral medicine, oral surgery, emergency, and minimal-to-general anesthesia documentation, including IV moderate sedation. Harmonize tooth and surface notation, procedure status, findings, consent language, image labels, medical-dental terms, and plain-language instructions while preserving clinician-supplied facts and flagging omissions or contradictions.
---

# Standardize Dental Notes

## Set the safety boundary

1. Accept only de-identified facts or blank-template requests.
2. Stop and ask the user to remove direct identifiers, all dates more specific than year, contact details, record numbers, locations below state, facial photographs, image files, and any free text that could identify a person.
3. Do not state that text is de-identified merely because obvious names are absent. Say that only the practice can complete its HIPAA de-identification review.
4. Do not diagnose, select treatment, choose a drug or dose, set a monitoring interval, decide anesthesia depth, assign a billing code, or determine discharge readiness.
5. Do not invent or silently complete facts. Preserve a blank or mark it unresolved.
6. Require a licensed clinician to compare the draft with the source record, resolve every flag, and sign in the electronic dental record.
7. Treat this Skill as a documentation aid, not clinical, legal, coding, or billing advice. Apply current state law, board rules, payer rules, facility policy, and manufacturer instructions.

## Choose the task

- For a new note, select the universal core and the smallest relevant add-on from assets/dental-note-templates.md.
- For normalization, apply references/terminology-and-style.md without changing meaning.
- For tooth or surface checks, apply references/tooth-and-surface-notation.md.
- For imaging or sedation, load references/sedation-and-imaging.md.
- For a Tennessee practice, load references/tennessee-dental-law-summary.md and apply its local checklist in addition to national guidance.
- For an evidence or policy question, consult references/source-ledger.md and verify that the cited source remains current.
- For a local practice rollout, produce a controlled copy, a change log, role-based training examples, and a state-specific review checklist.

## Draft in six passes

### 1. Classify each fact

Label facts by source when the distinction matters:

- clinician observed
- patient reports
- parent or guardian reports
- external record states
- test or image shows
- not assessed
- not applicable
- unknown

Never convert patient-reported or external information into a clinician finding.

### 2. Build the universal core

Include:

- visit purpose and interval events
- reviewed medical and dental history, medications, allergies, and relevant risk factors
- subjective symptoms with site, onset, course, severity scale, triggers, relief, and pertinent negatives when supplied
- objective examination, tests, images, and limitations
- clinician-supplied assessment or diagnosis
- options, material risks, expected benefits, alternatives, and no-treatment option discussed
- patient decision and consent or refusal status
- performed procedure with exact site, tooth, surface, material, device, drug, amount, route, time, and response when applicable
- complications or explicit statement that no complication was observed during the recorded period, if true
- condition at transfer or discharge, instructions, follow-up, referral, and return precautions
- author, role, attestation, and signature fields for completion only in the clinical system

### 3. Add the procedure module

Use one or more modules from the asset. Keep separate sections for each procedure and each anatomical site. For an uncommon procedure, use the Universal Procedure or Operative Add-On and name the exact procedure.

### 4. Normalize language

- Use active voice and direct subjects: the patient reports; the clinician observed; the dentist administered.
- Use short sentences and one idea per sentence when accuracy permits.
- Keep required medical and dental terms. Add a plain-language gloss only in patient instructions.
- Use one term for one concept throughout the note.
- Replace ambiguous abbreviations and vague words using the terminology reference.
- Distinguish recommended, planned, consented, started, completed, partly completed, stopped, deferred, and declined.
- Distinguish absent, not assessed, not applicable, and unknown.
- State measurements, units, site, method, and time when supplied.

### 5. Validate

Check and report, without fixing by inference:

- tooth designator is valid for the stated dentition
- surface is valid and matches anterior or posterior anatomy
- laterality, arch, quadrant, tooth, surface, and procedure do not conflict
- primary and permanent notation are not mixed
- diagnosis, planned treatment, consent, performed treatment, and billing fields do not contradict one another
- allergies, medications, medical conditions, anesthetic agents, and postoperative prescriptions do not conflict in the supplied facts
- local anesthetic and sedation totals reconcile with the source record
- sedation depth, staffing, monitoring, rescue readiness, recovery, and discharge fields are complete under the applicable rule set
- the narrative and time-oriented anesthesia record agree
- image indication, modality, anatomy, quality, findings, impression, and follow-up are linked
- CBCT documents review or referral for the entire acquired volume
- every placeholder and unresolved flag remains visible

### 6. Return the result

Return these sections in this order:

1. Draft note
2. Required clinician checks
3. Missing or conflicting facts
4. Terms changed, as a two-column before-and-after list, when normalizing existing text

Do not add generic warnings inside the clinical note. Put workflow warnings after the draft.

## Apply special controls

### Codes and licensed terminologies

- Do not reproduce CDT or SNODENT code sets or descriptors.
- Use a placeholder for a code unless the user provides it from the practice's current licensed source.
- Keep diagnosis, procedure, and billing concepts separate.
- Verify the current release before use. As of August 1, 2026, CDT 2026 is the current annual edition; this fact will expire.

### Consent

- Record the conversation, not merely a signed form.
- State the procedure, purpose, material risks, expected benefits, alternatives, no-treatment option, questions, and decision when supplied.
- Obtain consent before sedating medication impairs decision-making.
- Do not infer legal authority, capacity, or identity. Keep those facts in the clinical system, not in AI input.

### Sedation and anesthesia

- Use the narrative add-on only with the facility's time-oriented anesthesia record.
- Treat sedation depth as independent of route.
- Record exact clinician-supplied drug, dose, unit, route, and time. Never calculate or suggest a dose.
- Apply the current ADA guideline, pediatric AAP/AAPD guideline when relevant, AAOMS guidance when relevant, and stricter state or facility rules.
- Flag any missing preassessment, airway, fasting, baseline, monitoring, staffing, rescue, recovery, escort, instruction, or discharge element.

### Images

- Do not accept patient image files.
- Document image metadata and clinician-supplied interpretation only.
- Record prior-image review and the patient-specific reason for ionizing imaging.
- Use the smallest clinically suitable field of view and protocol only when this was the clinician's decision and is true.
- For CBCT, document interpretation of the entire acquired volume or referral to a qualified oral and maxillofacial radiologist.

### Tennessee practices

- Use the Tennessee summary only as an operational issue-spotter.
- Apply the current Tennessee Code, the current official compilation of Rule 0460, Board policies, federal law, and stricter applicable standards.
- Keep Tennessee-required dates, identities, signatures, notices, and permit numbers in the EDR or compliance system, not in AI input.
- Recheck the Secretary of State rule index and Board page before rollout and after each rule or legislative change.

## Refuse unsafe transformations

Refuse or narrow a request that asks to:

- fabricate a complete note from sparse facts
- create normal findings that were not examined
- backdate, alter, conceal, or overwrite a clinical entry
- generate a drug regimen or anesthesia plan
- choose a diagnosis or procedure for a real patient
- copy protected CDT or SNODENT content
- process identifiable patient text or images

Offer a blank template, a de-identification checklist, or a list of facts the clinician must supply.
