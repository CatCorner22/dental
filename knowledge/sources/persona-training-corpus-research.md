# Persona training corpus — litigation, Curve Hero, and staff-complaint research

- **Source**: Public risk-management case studies (MedPro Group Dental / OMS; The Doctors
  Company dental claims 2010–2020), PMC charting-malpractice case series, Curve Dental
  Zendesk / product documentation already ingested in this repo, and common themes from
  dental staff forums and productivity boards (charting lag, mouse-heavy UI, shorthand /
  AutoHotkey workarounds, copy-forward). No real patient notes were scraped. All training
  notes derived from this digest are synthetic and de-identified by construction.
- **Type**: research synthesis for synthetic training / eval design
- **Ingested**: 2026-08-04
- **Tags**: dental, clinical-notes, litigation, curve-hero, training, personas, human-factors

## Why this document exists

Smile Notes must train and evaluate against the *kinds of notes people actually write*
under time pressure — not tidy textbook SOAP. Production filings are off-limits
(charter + HIPAA). This digest grounds a frozen synthetic corpus and ten persona agents
so adversarial cases stay tied to real failure modes: litigation gaps, Curve Hero
template culture, and career-stage / generational complaint patterns.

## Litigation and claim-file patterns (USA, public sources)

| Pattern | What fails | Why defense suffers | Corpus tag |
|---|---|---|---|
| Sparse operative entry | "RCT complete #30 with local" / "Ext #30 with local" | Expert cannot reconstruct findings, consent, anesthetic agent/amount, technique, or reasoning years later (MedPro Dental / OMS case studies). Judge/jury heuristic: if it was not written, it did not happen. | `sparse-operative` |
| Imaging without interpretation | Radiographs "taken" with no findings | Looks like images nobody reviewed; diagnosis-related claims often include documentation deficits (MedPro diagnosis documentation brief). | `imaging-no-read` |
| Consent discussion without decision | "Risks discussed" / form signed, conversation not charted | Form ≠ conversation; decision (agreed / declined / deferred) missing from the encounter note. | `consent-half` |
| Extraction without outcome | Extraction stated; no hemostasis, complications, or post-op instructions | First three questions a later reader asks go unanswered. | `extraction-hollow` |
| Insufficient documentation as claim factor | ~19% of a closed dental-claim cohort flagged documentation issues; insufficient detail led | Carrier analysts treat missing detail as a causal factor independent of clinical skill. | `insufficient-detail` |
| Content / mechanics errors | Wrong chart, delayed entry, alteration, judgmental language | Alteration destroys credibility via EDR audit trail; stigmatizing language harms defense even when care was sound (PMC case series themes). | `record-mechanics` |
| Rationale absent | Procedure coded; clinical decision-making never narrated | Downstream providers and claim reviewers cannot see *why*; SRP / crown / buildup justification gaps. | `no-rationale` |
| Prescription incompleteness | Drug named without duration / supply / weight units reconciled | Pediatric dosing and interaction cases amplify when the chart cannot support a double-check. | `rx-incomplete` |

Sources (public): MedPro "Lack of Detail in Chart Entry Hinders Dentist's Malpractice Defense";
MedPro OMS analogue; The Doctors Company "Patient Safety in Dentistry: Documentation";
MedPro diagnosis-documentation brief; PMC "Charting Practices to Protect Against Malpractice".

## Curve Hero note-culture patterns (public product docs)

Already detailed in `curve-hero-pms-clinical-documentation.md`. Training-relevant behaviors:

1. **Template-first culture** — Curve Forms required fields block save; staff learn to
   satisfy the gate with minimal or recycled text rather than write a reconstructible note.
2. **Attachment vs tag** — notes created outside visit context may not attach even when
   tagged "Clinical History"; training notes simulate "orphan" language and copy-forward
   from a prior visit's template.
3. **Treatment Planning → Clinical History auto-convert** — pre-checkout notes that were
   never individualized become the legal Clinical History at checkout.
4. **Care+ / AI draft then human review** — over-fluent AI-flavored prose that invents soft
   tissue or consent detail the clinician never verified (maps to our verifyMeaning /
   no-hallucinated-fact rails).
5. **Sidekick speed pressure** — persistent patient context encourages rapid multi-module
   hopping; charting completeness loses to schedule pace.

## Staff message-board / complaint themes (career × generation)

Themes synthesized from recurring dental-assistant, hygienist, and dentist forum posts
and productivity-tool threads (not quoted as PHI, not attributed to named individuals):

| Theme | Who tends to voice it | Note-writing consequence |
|---|---|---|
| "Charting takes longer than the appointment" | Early-career assistants / hygienists | Telegraphic stubs; anesthetic and imaging cues without amounts or reads |
| "Cloud lag / mouse-heavy clicks" | All ages; louder among staff who remember paper or desktop PMS | Delayed entries; same-day batch charting from memory; wrong-visit attach risk |
| "Just use the template / AutoHotkey" | Tech-comfortable Gen Z / Millennials | Copy-forward; placeholders left as `TBD` or bracket residue; textisms |
| "I've done this for thirty years — the note is fine" | Near-retirement clinicians | Sparse operative classics; resistance to required fields; abbreviations without a shared key |
| "Front desk told them to rinse with salt water" | Non-clinical staff pressured to "handle it" | Clinical advice in administrative notes; role-boundary failures |
| "AI will write it for me" | New grads and high-openness associates | Fluent filler, passive voice, invented WNL soft tissue, consent checkbox theater |
| "Insurance needs the code narrative" | Mid-career leads / coordinators | Procedure-forward notes that still omit clinical rationale (SRP without probing) |

### Career-stage mistake clusters (used by the ten agents)

- **New staff (≈22–28)**: speed shortcuts, textisms / nonstandard shorthand, copy-forward,
  incomplete anesthetic amounts, imaging without interpretation, over-trust of templates.
- **Mid-career (≈34–55)**: template minimalism that "passes" PMS required fields, role creep
  (managers writing clinical content), dense private abbreviation systems, consent as form
  reference only.
- **Late career / near retirement (≈62–85)**: extreme sparsity ("with local"), delayed or
  memory-based charting, outdated terms, weak supervision / tele-dentistry documentation,
  occasional judgmental phrasing from an era when charts were less discoverable.

Open-mindedness modulates *recovery*, not defect type: high-openness agents accept
coaching and over-correct into fluff; low-openness agents under-correct and reassert the
sparse habit.

## Mapping into this repository

| Artifact | Role |
|---|---|
| `src/lib/training/persona-agents.ts` | Ten frozen persona definitions (IQ 85–140, age 22–85, openness spectrum) |
| `src/lib/training/synthetic-notes.ts` | One primary synthetic note per agent + eval tags |
| Existing `completeness.*`, `justify.*`, `vague.*`, `medsafe.*`, `residue.*` | Deterministic catches where the note's wording matches a rule trigger |
| Byte / ByteStar canaries | Semantic defect tags guide future coach/eval cases without training on filed notes |

## Hard constraints (do not violate)

- No real patient content, names, dates of birth, phone numbers, or practice PHI.
- No scraping of closed charts from Curve Hero or any PMS.
- Synthetic notes may *resemble* public risk-management exemplars; they must not copy
  identifiable case facts.
- The deterministic transformer still must not invent clinical facts when these notes are
  standardized — planted defects are for audit/coach evaluation, not for the model to "fix."
