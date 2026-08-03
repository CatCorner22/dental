# Benchmark: Smile Notes vs Curve Hero

- **Baseline source**: `knowledge/sources/curve-hero-pms-clinical-documentation.md`
- **Assessed**: 2026-08-03, against the code, not the README
- **Method**: capability-by-capability, with every Smile Notes claim traced to a file

## The honest framing

These are not the same kind of product, and a comparison that forgets it produces a to-do list
that would destroy this one. Curve Hero is an all-in-one cloud practice management system in
which clinical notes are one module beside scheduling, charting, imaging, perio, and billing.
Smile Notes is a de-identified, deterministic documentation-standardization layer that holds no
patient record at all.

So most of Curve's surface area is **out of scope by design, not a gap**. The comparison only
means something inside the sliver that actually overlaps: composing a structured clinical note
from reusable templates with controlled vocabulary and error-proofed dental variables.

## Verdict

Inside that sliver, Smile Notes is **ahead on enforcement and note intelligence** and **behind on
reach and portability**.

Ahead, with nothing comparable described in the Curve source:

- A five-severity deterministic audit that blocks export server-side, so a tampered client cannot
  push a note past the gate.
- ADA Universal validation across four dentitions including supernumerary designations, with
  anterior/posterior surface legality enforced in the control *and* re-checked in the audit.
- FDI-notation leakage caught by name.
- Medication-name typos pinned at a severity that is never auto-fixed.
- A vague-phrase rule aimed at the exact phrases that fail in deposition — "tolerated well",
  "hemostasis achieved", "consent obtained".
- A frozen note **and** frozen audit report **and** ruleset version per ticket, written in one
  transaction.
- A capability model keyed on the target's role, with separation of duties on the two account-
  takeover paths.
- The Data Hygiene Gauntlet — a governance gate on schema change with no Curve analogue.

Behind, on things genuinely in scope:

| Gap | Status |
| --- | --- |
| Structured site capture reached only 4 of 28 modules | **Addressed** — now 11; the tooth-centric procedural modules take a validated tooth field |
| Free-text anatomy rule only fired on the literal word "tooth"; never checked surfaces | **Addressed** — `#19`, `No. 19`, and impossible surfaces in narrative are now caught |
| No export of a filed note; screen-read only | **Addressed** — copy, download, and print on the submission page |
| No practice-level rollup of what is being filed | **Open** — nothing records which modules or finding categories are in play, so there is no kaizen loop |
| Templates change only by code deploy | **Open, and constrained** — see below |

## The template-authoring question

Curve lets staff build their own note templates. Copying that shape would be a mistake here:
every practice-authored field is standardization the audit engine cannot see, which turns one
standard into local dialects and makes the ruleset version meaningless.

The version worth building is narrower: a **versioned, data-driven module registry** whose edits
are developer-only, admissible only against a sterile Gauntlet verdict, auto-bump the ruleset
version, and still run the dogfooding audit over every new label and phrase before publish. That
is a different product from Curve Forms and should not be described as parity with it.

## Deliberately not building

Each of these needs either patient data or an AI call, and refusing both is the entire safety
argument:

Scheduling · billing · claims · insurance estimation · treatment-plan cards · eSign · patient
portal · recare · imaging acquisition · odontogram-of-record · perio pocket-depth charting ·
patient/visit/procedure objects · note-to-visit attachment · behavioral note tags · Critical-note
pop-ups · checkout auto-conversion · ambient AI transcription · voice charting · AI note
generation.

Two more that look attractive and are not:

- **FHIR or C-CDA export as the first portability move.** Without procedure codes or encounter
  identifiers the document cannot be conformant, so shipping it would claim something the artifact
  does not support. A well-specified flat export first.
- **Any cross-staff comparison or scoring** built on practice-level analytics. Scoring clinicians
  on audit findings produces notes optimized for the checker instead of for the patient.

## What is still open, ranked

1. **Record module set and per-category finding counts on submissions, plus a practice rollup.**
   It is the only way to know whether the fixes above worked. Practice-level only, never per-staff.
2. **Date-ranged bulk export** of filed submissions for a records request.
3. **Surface capture beyond the two modules that have it**, now that the tooth fields exist.
4. **`amendsSubmissionId`** so a late entry points at the ticket it amends — an amendment chain
   that exists on one side only is a weak spot in a record asserted to be legal.
5. **The versioned module registry**, last, because building an authoring tool for a schema still
   being redesigned is premature.
