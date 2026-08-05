# USA litigation and documentation — claim-file research for risk-reduction rules

- **Source**: Web research compiled 2026-08-05 from The Doctors Company closed dental
  claims analysis (1,185 claims, 2010–2020), MedPro Group Dental / WSDA case study
  ("RCT complete #30 with local"), The Doctors Company referral and informed-refusal
  guidance, RCDSO disciplinary panel case study on periodontal recordkeeping,
  Dentist's Advantage delayed-diagnosis referral case study, DrBicuspid periodontal
  litigation summary, and prior digests in this repo (`industry-note-standards-and-safety.md`,
  `persona-training-corpus-research.md`).
- **Type**: research synthesis for audit-rule design and advisor knowledge
- **Ingested**: 2026-08-05
- **Tags**: dental, clinical-notes, risk-reduction, documentation, informed-consent,
  malpractice-claims, doctors-company, medpro, claim-files

## Epistemic frame (read this first)

This product is a **language optimizer for risk reduction**, not a litigation-avoidance
guarantee. That distinction matters because the underlying research problem is a
**negative proof**: you cannot observe a lawsuit that never happened, and you cannot
run a controlled trial that proves a better note would have changed a jury outcome.

What claim-file research *can* support — with calibrated confidence:

| Claim | Confidence | Basis |
|---|---|---|
| Documentation gaps appear in a measurable share of closed dental claims | **High** | The Doctors Company: documentation issues in **19%** of 1,185 closed dental claims (2010–2020), fifth-leading causal factor |
| When documentation is insufficient, three content gaps dominate | **High** | Within the insufficient-documentation subset (172 items): **clinical findings (68)**, **informed consent (55)**, **clinical rationale (51)** |
| Sparse operative entries undermine defense reconstruction years later | **High** | MedPro/WSDA case study: expert cited departures including consent, antibiotic timing, and technique — chart showed only "RCT complete #30 with local" |
| Experts and juries weight "if it wasn't written, it didn't happen" | **Medium-high** | Repeated in carrier guidance and trial-attorney commentary; heuristic, not a statute |
| Better notes *prevent* specific lawsuits | **Low / unprovable** | No counterfactual; correlation in claim files only |
| Automated rules reduce documentation gaps at point of care | **Medium** | Plausible from human-factors and checklist literature; requires practice adoption metrics we do not yet have in production |

**Design implication**: encode the recurring *documented* gaps as S2 coaching rules and
advisor entries with citations. Never promise litigation outcomes in user-facing copy.

## Primary quantitative source — The Doctors Company (dental, 2010–2020)

The Doctors Company reviewed **1,185 closed dental malpractice claims**. Analysts flagged
documentation as a causal factor in **19%** of claims (fifth-leading factor overall).

Within insufficient documentation, the top **content** gaps were:

| Gap | Count (within insufficient-documentation subset) | Share of that subset |
|---|---|---|
| Clinical findings | 68 | ~40% |
| Informed consent | 55 | ~32% |
| Clinical rationale | 51 | ~30% |

(Counts overlap categories; a single claim can contribute multiple gap types.)

**Content decisions** (alteration, judgmental entries) and **documentation mechanics**
(wrong chart, delayed entry, transcription errors) were separate failure classes — not
encoded here as completeness rules but covered by record-mechanics training tags.

**Direct correlation**: analysts found a direct correlation between poor documentation
and adverse events in **14** claims — a small absolute number, which reinforces that
documentation is rarely the sole cause but often compounds defense difficulty.

Sources:
- [Patient Safety in Dentistry: Documentation](https://www.thedoctors.com/articles/patient-safety-in-dentistry-documentation)
- [Documentation to Defend Quality Patient Care](https://www.thedoctors.com/articles/the-faintest-ink-documentation-to-defend-quality-patient-care)

## Case-pattern themes (public, note-linked)

### 1. Sparse operative summary (MedPro / WSDA)

**Chart**: "RCT complete #30 with local."

**Missing per defense expert**: radiographic and clinical findings, informed consent
process, anesthetic agent and amount, technique (file sizes, filling material, cement),
diagnostic reasoning for steps taken and deferred (including antibiotic timing).

**Carrier rule of thumb**: another dentist should reconstruct the visit from the note alone,
without interviewing the author or patient.

**Smile Notes encoding**: `complete.anesthetic-no-amount`, `complete.imaging-no-interpretation`,
`complete.consent-no-decision`, `complete.clinical-rationale` (new in ruleset 2.21.0).

Source: [MedPro — Lack of Detail in Chart Entry](https://medprodental.com/practice-more-safely/lack-of-detail-in-chart-entry-hinders-dentists-malpractice-defense);
[WSDA blog mirror](https://www.wsda.org/news/blog/2025/01/20/lack-of-detail-in-chart-entry-hinders-dentist-s-malpractice-defense)

### 2. Consent checkbox theater (Doctors Company + TN case law)

**Failure mode**: "Patient consented" or a signed form on file without charting the
**conversation** — diagnosis discussed, material risks, alternatives (including no
treatment), patient questions, teach-back, decision in the patient's terms.

**Doctors Company guidance**: informed consent is a **process**, not a signature.
"Consented patient" and "patient consented" are explicitly insufficient.

**Smile Notes encoding**:
- `complete.consent-no-decision` — discussion documented, decision missing
- `complete.consent-thin-assertion` — assertion/signature documented, conversation substance missing (new 2.21.0)
- Advisor: `byte.consent-is-a-conversation`

### 3. Clinical rationale absent (Doctors Company #3 gap)

**Failure mode**: procedure coded or narrated without **why** — e.g., crown without decay
or fracture context, SRP without periodontal diagnosis, extraction without indication.

**Defense impact**: experts reconstructing standard-of-care and causation cannot see the
decision path; the note reads as procedure-first billing narrative.

**Smile Notes encoding**: `complete.clinical-rationale` (new 2.21.0).

### 4. Imaging acquired, not interpreted (overlap with TN law)

**Failure mode**: "4 BWs taken" with no findings, interpreter, or pending-interpretation owner.

**Smile Notes encoding**: `complete.imaging-no-interpretation`; TN rule cites radiographs
**and interpretations** as record elements.

### 5. Informed refusal silence (referral / periodontal cases)

**Failure mode**: recommendation or referral offered verbally; chart shows cleaning visits
only. Patient later alleges never informed of periodontal disease or consequences of refusal.

**RCDSO panel (Mr. A / Dr. B)**: no documented diagnosis, no referral, no refusal
documentation despite claimed conversations — panel found record unsupported defense.

**Smile Notes encoding**: advisor `byte.informed-refusal`, `byte.referral-loop`; retrieval
`REFUSAL_RULES`.

Sources:
- [RCDSO recordkeeping case study](https://www.rcdso.org/standards-guidelines-resources/rcdso-news/articles/12754)
- [Doctors Company — Referral and negligent referral](https://www.thedoctors.com/articles/referral-and-negligent-referral-in-a-dental-practice)
- [DrBicuspid — periodontal litigation](https://www.drbicuspid.com/dental-practice/article/15371565/legal-cases-failure-to-diagnose-and-treat-periodontal-disease)

### 6. Delayed diagnosis / referral documentation (Dentist's Advantage)

**Chart pattern**: brief entries ("Exam, FMX, prophy") until pain forces action; later
specialist documents long-standing lesion. Patient alleges delayed diagnosis.

**Note**: OMFS may testify delay of months would not change outcome — **documentation still
failed to show earlier findings, patient counseling, or follow-up**.

**Smile Notes encoding**: soft-tissue disposition (`byte.soft-tissue-close-the-loop`);
referral loop; not a dedicated delayed-diagnosis rule (requires clinical judgment beyond
text patterns).

Source: [Dentist's Advantage — $20K delayed diagnosis case](https://www.dentists-advantage.com/Prevention-Education/Case-Studies/Content/$20K-settlement-in-delayed-diagnosis-and-referral)

### 7. Record alteration and timeliness (Doctors Company)

**Failure mode**: late entries, metadata showing backdating, or rewritten entries.

**Impact**: credibility damage independent of clinical quality; spoliation arguments.

**Smile Notes encoding**: advisor `byte.amendment-not-erasure`; addendum verified block;
frozen submission history.

## Expert-witness review pattern (how charts are read in litigation)

When a case reaches expert review, the workflow is roughly:

1. **Standard of care** — what a reasonably prudent dentist would do in similar circumstances
2. **Deviation** — whether care fell below that standard
3. **Causation** — whether deviation caused the alleged harm
4. **Documentation** — whether the record supports or undermines steps 1–3

Experts **cannot testify to conversations not in the record**. Incomplete records shift
argument to deposition memory contests the defense does not control.

## Industry-leading documentation practices (evidence-based, not marketing)

| Practice | Source | Encoded in Smile Notes |
|---|---|---|
| Document clinical findings objectively (measurements > adjectives) | ADA SOAP guidance; CNA claim files | `byte.specifics-beat-adjectives`; extraction facts |
| Informed consent as documented conversation + teach-back | Doctors Company; Sanders (Tenn.) | consent completeness rules; advisor entries |
| Informed refusal mirrors consent | CNA; Doctors Company | `byte.informed-refusal`; REFUSAL_RULES |
| Name anesthetic agent, concentration, amount | TN minimum record; MedPro cases | `complete.anesthetic-no-amount` |
| Radiograph interpretation in record | TN Comp. R. 0460-02-.12 | `complete.imaging-no-interpretation` |
| Procedure outcome + post-op for surgery/extraction | Schwarcz; MedPro | `complete.extraction-no-outcome` |
| Clinical rationale for treatment chosen | Doctors Company #3 gap | `complete.clinical-rationale` |
| Referral loop: to whom, why, urgency, follow-up | Doctors Company referral guidance | `byte.referral-loop` |
| Append-only corrections | TN rule; spoliation doctrine | `byte.amendment-not-erasure` |
| Another-dentist reconstructibility test | MedPro/WSDA rule of thumb | advisor pillars + completeness suite |

## Mapping table — research gap → rule / coach

| Research gap | Rule ID | Severity | Advisor ID |
|---|---|---|---|
| Imaging without interpretation | `complete.imaging-no-interpretation` | S2 | `byte.radiograph-interpretation` |
| Anesthetic without amount | `complete.anesthetic-no-amount` | S2 | `byte.dose-context` |
| Extraction without outcome | `complete.extraction-no-outcome` | S2 | `byte.extraction-aftercare` |
| Rx without duration | `complete.rx-no-duration` | S2 | — |
| Consent discussion, no decision | `complete.consent-no-decision` | S2 | `byte.consent-is-a-conversation` |
| Consent assertion, no substance | `complete.consent-thin-assertion` | S2 | `byte.consent-is-a-conversation` |
| Procedure without rationale | `complete.clinical-rationale` | S2 | `byte.clinical-rationale` |
| Referral without recipient or reason | `complete.referral-loop-open` | S2 | `byte.referral-loop` |

## Residual risks and honest limits

- **Pattern rules miss judgment calls**: a note can satisfy every regex and still be clinically
  wrong, or fail a rule while being adequate after human attestation (S2 attest path exists).
- **State variation**: citations include TN law and multi-state carrier guidance; the practice
  must confirm local consent and record rules with counsel.
- **Causation ≠ documentation**: good documentation does not fix bad dentistry; bad documentation
  can sink defensible dentistry.
- **No production outcome data yet**: whether Smile Notes reduces claim incidence is an open
  question requiring practice-level adoption and longitudinal review — not something this digest
  can claim.

## Related repo artifacts

- `knowledge/sources/industry-note-standards-and-safety.md` — ADA/ISMP safety + initial litigation patterns
- `knowledge/sources/persona-training-corpus-research.md` — synthetic training tags
- `src/lib/audit/rules/completeness.ts` — anticipatory completeness rules
- `src/lib/advisor/knowledge.ts` — source-cited coaching entries
- `src/lib/assist/retrieval.ts` — consent/refusal context for assist (language optimizer layer)
