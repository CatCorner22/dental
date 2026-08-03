# Knowledge Base Index

Each source below links to its file in `knowledge/sources/`. Entry format:
`- **[<Title>](sources/<slug>.md)** — <one-line summary>. Tags: <tags>. Ingested: <date>.`

## Dental PMS benchmarks

- **[Curve Hero (Curve Dental) — clinical documentation & notes system](sources/curve-hero-pms-clinical-documentation.md)** — Deep benchmark of Curve Hero's Sidekick context panel, odontogram charting, note tags/attachment rules, Curve Forms template builder, and Care+ ambient AI, with explicit implications for this notes-standardization app. Tags: dental, pms, clinical-notes, note-templates, benchmarking, ai-documentation, ux. Ingested: 2026-08-02.

## Assessments derived from the sources above

- **[Benchmark: Smile Notes vs Curve Hero](benchmarks/smile-notes-vs-curve-hero.md)** — Capability-by-capability assessment against the Curve Hero baseline, assessed against the code rather than the README, and careful about the framing: Curve Hero is an all-in-one practice management system, so most of its surface is out of scope by design rather than a gap. Tags: dental, pms, benchmarking, clinical-notes. Ingested: 2026-08-03.

## The deployment target

- **[Cornerstone Dental Arts — practice profile and Curve Hero standardization](sources/cornerstone-dental-arts-practice-profile.md)** — The actual practice: three Knoxville offices, ~30 staff, doctors/hygienists/assistants/coordinators, its own 15-term approved abbreviation dictionary, and service lines (sleep apnea, TMJ/TMD, cosmetic, facial aesthetics) that have no note module yet. Tags: dental, pms, clinical-notes, note-templates, benchmarking, tennessee, compliance, deployment. Ingested: 2026-08-03.

## Legal and regulatory

- **[Standardizing Tennessee Dental Patient Notes for Curve Hero](sources/tn-dental-note-standardization-curve-hero.md)** — Tennessee dental-record law (7-year adult retention, minimum content, dentist-only diagnosis) benchmarked against WA/TX/CA/FL, plus a transformer spec whose MUST-NOT list forbids inferring any clinical fact, and blocking validation rules for release. Tags: dental, clinical-notes, tennessee, compliance, legal, note-templates, transformer, audit, benchmarking, rbac. Ingested: 2026-08-03.
- **[Legal Best Practices for Dental Office Patient Notes (Cornerstone)](sources/tn-dental-legal-best-practices.md)** — Resolves the 7-vs-10-year retention question (adults 7 under the Board rule; the 10-year figure is the *minors* rule from a different authority), reproduces the Joint Commission do-not-use list that independently confirmed this project's dose-safety gaps, and covers 2026 HIPAA Security Rule changes, consent for minors, and Cures Act patient-readable language. Tags: dental, clinical-notes, tennessee, compliance, legal, hipaa, consent, audit, note-templates. Ingested: 2026-08-03.

## Industry standards and safety research

- **[USA industry note standards, prescription safety, and litigation patterns](sources/industry-note-standards-and-safety.md)** — ADA/AAPD structure and template guidance, the kilogram rule and pediatric dosing error patterns (JC Sentinel Event Alert 39, ISMP), the SDCEP dental drug-interaction short list, and the litigation failure patterns from carrier claim files — each mapped to the specific Smile Notes rule that encodes it. Tags: dental, clinical-notes, compliance, medication-safety, litigation, ISMP, ADA, AAPD, curve-hero. Ingested: 2026-08-03.

## Development methodology

- **[Cross-platform LLM Code Transformer Skills Suite — adoption digest](sources/llm-transformer-skills-suite.md)** — User-supplied agent-skill pack (16x-style transformer workflow, verification suite, SICA-style continuous improvement); the practices worth keeping were distilled into `.cursor/rules/transformer-development.mdc` rather than vendoring the generic files, and the suite's chain-of-verification idea exists in the product in stronger deterministic form as `verifyMeaning()`. Tags: agent-skills, verification, process, prompt-engineering. Ingested: 2026-08-03.
