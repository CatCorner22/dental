# Knowledge Base Index

Each source below links to its file in `knowledge/sources/`. Entry format:
`- **[<Title>](sources/<slug>.md)** — <one-line summary>. Tags: <tags>. Ingested: <date>.`

## Dental PMS benchmarks

- **[Curve Hero (Curve Dental) — clinical documentation & notes system](sources/curve-hero-pms-clinical-documentation.md)** — Deep benchmark of Curve Hero's Sidekick context panel, odontogram charting, note tags/attachment rules, Curve Forms template builder, and Care+ ambient AI, with explicit implications for this notes-standardization app. Tags: dental, pms, clinical-notes, note-templates, benchmarking, ai-documentation, ux. Ingested: 2026-08-02.

## Project Artifact

The living synthesis for the deployment. Read this first in a new session — it links to the
sources below rather than repeating them, and carries the open questions and next actions.

- **[Cornerstone Dental Arts — Project Artifact](artifact/cornerstone-dental-arts.md)** — goal, source
  ingest log with confidence ratings, key findings, known and suspected unknown unknowns, structured
  challenges, and next actions. Tags: dental, tennessee, compliance, deployment, artifact.
  Updated: 2026-08-03.

## Assessments derived from the sources above

- **[Benchmark: Smile Notes vs Curve Hero](benchmarks/smile-notes-vs-curve-hero.md)** — Capability-by-capability assessment against the Curve Hero baseline, assessed against the code rather than the README, and careful about the framing: Curve Hero is an all-in-one practice management system, so most of its surface is out of scope by design rather than a gap. Tags: dental, pms, benchmarking, clinical-notes. Ingested: 2026-08-03.
- **[Assessment: UX, visual design, and performance review](benchmarks/ux-performance-review.md)** — Live-browser walkthrough at desktop and mobile widths plus a production-build audit; two real issues found and fixed (mobile audit panel buried below the form, unlazy note-page dialogs), one issue found and deliberately left for a dedicated pass (mobile nav wrapping), and an explicit distinction between what "promote use" should mean for an internal tool versus a storefront. Tags: ux, accessibility, performance, mobile, next.js, benchmarking. Ingested: 2026-08-03.

## The deployment target

- **[Cornerstone Dental Arts — practice profile and Curve Hero standardization](sources/cornerstone-dental-arts-practice-profile.md)** — The actual practice: three Knoxville offices, ~30 staff, doctors/hygienists/assistants/coordinators, its own 15-term approved abbreviation dictionary, and service lines (sleep apnea, TMJ/TMD, cosmetic, facial aesthetics) that have no note module yet. Tags: dental, pms, clinical-notes, note-templates, benchmarking, tennessee, compliance, deployment. Ingested: 2026-08-03.

## Legal and regulatory

- **[Standardizing Tennessee Dental Patient Notes for Curve Hero](sources/tn-dental-note-standardization-curve-hero.md)** — Tennessee dental-record law (7-year adult retention, minimum content, dentist-only diagnosis) benchmarked against WA/TX/CA/FL, plus a transformer spec whose MUST-NOT list forbids inferring any clinical fact, and blocking validation rules for release. Tags: dental, clinical-notes, tennessee, compliance, legal, note-templates, transformer, audit, benchmarking, rbac. Ingested: 2026-08-03.
- **[Legal Best Practices for Dental Office Patient Notes (Cornerstone)](sources/tn-dental-legal-best-practices.md)** — Resolves the 7-vs-10-year retention question (adults 7 under the Board rule; the 10-year figure is the *minors* rule from a different authority), reproduces the Joint Commission do-not-use list that independently confirmed this project's dose-safety gaps, and covers 2026 HIPAA Security Rule changes, consent for minors, and Cures Act patient-readable language. Tags: dental, clinical-notes, tennessee, compliance, legal, hipaa, consent, audit, note-templates. Ingested: 2026-08-03.

## Industry standards and safety research

- **[USA industry note standards, prescription safety, and litigation patterns](sources/industry-note-standards-and-safety.md)** — ADA/AAPD structure and template guidance, the kilogram rule and pediatric dosing error patterns (JC Sentinel Event Alert 39, ISMP), the SDCEP dental drug-interaction short list, and the litigation failure patterns from carrier claim files — each mapped to the specific Smile Notes rule that encodes it. Tags: dental, clinical-notes, compliance, medication-safety, litigation, ISMP, ADA, AAPD, curve-hero. Ingested: 2026-08-03.

- **[Transferable patterns from other high-stakes documentation domains](sources/high-stakes-documentation-patterns.md)** — Deliberately not a dental-software scan: readback/hearback and killer items from aviation, playbook tiers and suggestion-mode conventions from contract review, named omission licences and determinant codes from emergency medical dispatch, independent verification and "pause when unsure" from DOE human-performance doctrine, WCAG 3.3.4 and GOV.UK check-answers from form design, and eCTD `replace` semantics plus Annex 11 reason-for-change from regulated provenance — each with a concrete, costed application to this transformer and an explicit list of what could not be verified. Tags: aviation, human-factors, emergency-dispatch, nuclear-safety, legal-tech, accessibility, wcag, poka-yoke, audit-trail, gxp, ectd, provenance, ux. Ingested: 2026-08-03.

## Development methodology

- **[Building Reliable Transformer-Powered Input-to-Standard-Output Tools](sources/transformer-input-to-standard-output-guide.md)** — Architecture guide for input-transformation apps: deterministic cleanup first, typed contracts on both sides of the model, independent validation after, visible diffs, and pipeline-level evaluation. Confirms most of what this project already does and named the gaps that became the diff, preview-then-apply, schema-constrained capabilities, eval set and telemetry. Its provider-portability chapters are deliberately **not** adopted — one platform, by the owner's decision. Tags: architecture, transformer, ai-documentation, verification, prompt-engineering, process, security, evaluation. Ingested: 2026-08-03.
- **[Designing a bespoke language model that is actually an LLM](sources/bespoke-llm-build-paths.md)** — External decision guide on the six build paths from prompting to from-scratch pretraining, with a control ladder that makes "bespoke AI system" versus "bespoke LLM" a precise distinction rather than a marketing one. Independently confirms four positions this project reached on its own reasoning — training on production logs, one LLM as teacher/reward/judge, SFT-as-database, and from-scratch-for-branding are its failure patterns #23, #12, #11 and #3 — and names one thing we have NOT done that it argues for: encoder-only classification for narrow prediction tasks such as abbreviation disambiguation. Landed as `docs/model-charter.md`. Tags: llm, architecture, training, evaluation, governance, privacy, decision-record. Ingested: 2026-08-04.
- **[Cross-platform LLM Code Transformer Skills Suite — adoption digest](sources/llm-transformer-skills-suite.md)** — User-supplied agent-skill pack (16x-style transformer workflow, verification suite, SICA-style continuous improvement); the practices worth keeping were distilled into `.cursor/rules/transformer-development.mdc` rather than vendoring the generic files, and the suite's chain-of-verification idea exists in the product in stronger deterministic form as `verifyMeaning()`. Tags: agent-skills, verification, process, prompt-engineering. Ingested: 2026-08-03.
