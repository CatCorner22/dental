# Curve Hero note standardization and litigation-informed transformer blueprint

**Ingested:** 2026-08-04. **Type:** owner-supplied deep-research blueprint.
**Companion:** `tn-des12-legal-blueprint.md` (Tennessee statutes and the 2027
supervision change live there; this one carries the Curve mechanics and the AI
gating language).

## The findings that matter most here

**Visit attachment beats the tag.** A note tagged Clinical History from Sidekick
or the Notes module is NOT attached to the visit; only a note created from the
Visit or from Charting History attaches to the date of service. The post-paste
verification in the Standardize flow (correct patient, correct date, note icon
under the visit) exists because of exactly this trap, and the copy-confirmation
dialog's two-identifier check stays.

**No public Curve write API.** Availability is unspecified until Curve provides
written technical and contractual documentation. Clipboard mode ships first;
an API adapter stays an inactive interface. This matches the app's design and is
now the recorded reason.

**Curve Care+ ships ambient AI notes** (60-minute session limit, mandatory
review before saving, AI Auto Link in some flows). The incumbent writes AI prose
and asks users to re-read it. That is the competitive bar for the AI layer.

**The AI gating language this project adopted as its acceptance test:**

> Optional transcription ingestion, source-span mapping, confidence labels,
> unsupported-assertion rejection, human correction interface.
> Exit criteria: **No AI-generated clinical fact can be finalized without
> visible source evidence or affirmative clinician confirmation.**

This is the specification for the evidence-pinned extraction capability: the
model proposes structured facts pinned to source spans; a deterministic
verifier rejects any fact whose span does not support it; a human accepts each
fact individually; provenance carries `sourceTranscriptSpan`.

**Hard-stop and warning tables.** Largely congruent with the audit engine's
S0/S1 gates and S2 warnings. Divergences worth tracking: consent-timestamp-
after-treatment (temporal check not yet built), code-narrative conflict
(needs billing codes the app does not ingest), and the radiograph
acquisition-vs-interpretation split (partially covered by completeness rules).

**Provenance model.** Field-level `{value, status, sourceType, enteredBy,
enteredByRole, confirmedBy, certainty, copiedFromEncounter,
sourceTranscriptSpan}`. The blueprint's warning that Curve's audit trail is
activity evidence, not a version-control system, is the reason provenance must
travel IN the note text rather than being assumed recoverable from metadata.

## Adopted / deferred

Adopted now: the AI exit criterion (as the acceptance test for extraction);
span provenance in the extraction schema; the "render only facts that came from
a structured input, displayed source text, or an explicitly approved inference"
rule, which the deterministic transformer already obeys.

Deferred, tracked: DES-12 rendering order as an optional output format;
stacked-template duplicate/conflict check (partially covered by the
contradiction rules); the full phased-delivery governance table (the practice's
call, not the codebase's).
