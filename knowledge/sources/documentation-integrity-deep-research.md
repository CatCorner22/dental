# Documentation integrity — deep-research digest (dental scope)

- **Source**: Owner-supplied deep research report *Patient-Encounter Notes in U.S.
  Dental, Medical, and Pharmacy Practice* (uploaded 2026-08-05), critically
  cross-referenced against Smile Notes audit rules, advisor knowledge, and
  `litigation-documentation-research.md`.
- **Type**: research synthesis for language-optimizer risk-reduction rules
- **Ingested**: 2026-08-05
- **Tags**: dental, clinical-notes, risk-reduction, documentation-integrity,
  consent, billing-narrative, bounded-negatives, CMS, ADA, AHIMA

## Epistemic frame

This digest supports a **language optimizer for risk reduction**. It does **not**
promise litigation avoidance, payment guarantees, or automatic compliance.

The report is a national framework covering dental, medical, and pharmacy. Smile
Notes encodes **dental encounters + dental prescribing** only. Medical CERT
packet workflows and pharmacy DEA red-flag systems are parked below.

## Four functions of the encounter note

| Function | Operational meaning |
|---|---|
| Care communication | Another clinician can continue care from the note alone |
| Safety / continuity | Open loops (results, referrals, monitoring) have owners |
| Evidentiary record | Material facts of assessment, decision, treatment, and follow-up are reconstructible |
| Payment support | Narrative does not conflict with billed services (codes live in the EDR) |

ADA and CMS both treat the chart as evidence when care or claims are challenged.
The product posture matches the report’s design conclusion: **improve expression
of known facts; never generate new clinical facts.**

## Multi-audience risk table (correlation, not prevention)

| Reviewer | Principal question | Frequent note vulnerability | Smile Notes posture |
|---|---|---|---|
| Malpractice / expert | Reasonable assessment, decision, communication, follow-up? | Missing findings, rationale, consent, referral, alteration | Completeness + advisor pillars; no outcome promises |
| Licensing board | Recordkeeping and professional duties met? | Incomplete chart, missing supervision, disrespectful language | TN rules + stigma/vague gates |
| Payer / CERT-style audit | Service performed, necessary, correctly attributable? | Insufficient detail, cloned text, code-note mismatch | Justification rules; no CDT auto-coding |
| Fraud / FCA exposure | Unsupported or false claims submitted? | Template theater, services not documented | Never invent necessity or performance |
| HIPAA / privacy | Appropriate creation, amendment, disclosure? | Excess sensitive detail; AI PHI transfer | PHI gate before any provider call |
| Internal quality | Patterns correctable before an external event? | Repeated omissions, open follow-up loops | Team Lead digests + completeness suite |

## Bounded negatives (report insight)

A record cannot prove every conceivable negative. Prefer scoped language:

| Type | Example | Evidentiary meaning |
|---|---|---|
| Patient-reported | “Patient denies fever or facial swelling today.” | What the patient said |
| Clinician-observed | “No facial swelling observed on today’s examination.” | Scope of observation |
| Procedure-bounded | “No immediate complication observed before discharge.” | Limited period |
| Overbroad absolute | “Patient had no complications.” / “No problems.” | Avoid — implies knowledge beyond the encounter |

Encoded as: `vague.no-complications` (and sibling absolute-negative phrases),
advisor `byte.bounded-negatives`, and assist non-goals that refuse invented
“no complications” sentences.

## Failure taxonomy → Smile Notes encoding

| Report risk category | Encoded in app | Gap / park |
|---|---|---|
| Consent treated as form only | `complete.consent-thin-assertion`, `complete.consent-no-decision` | — |
| Refusal poorly documented | `byte.informed-refusal`, stigma/vague refusal wording | — |
| Clinical rationale / necessity gap | `complete.clinical-rationale`, `justify.*` | — |
| Procedure-detail gap (anesthetic, outcome) | `complete.anesthetic-no-amount`, `complete.extraction-no-outcome` | — |
| Imaging without interpretation | `complete.imaging-no-interpretation` | — |
| Unresolved referral | `complete.referral-loop-open`, `byte.referral-loop` | Urgency optional |
| Missing follow-up | `complete.procedure-no-followup` (2.23.0) | — |
| Soft-tissue / finding open loop | `complete.finding-no-disposition` (2.23.0), `byte.soft-tissue-close-the-loop` | — |
| Medication-information gap | `complete.rx-no-duration`, `complete.rx-no-indication` (2.23.0), medsafe rules | Pharmacy DEA red flags parked |
| Cloning / stale carry-forward | `residue.*`, digest similarity | Cross-patient crypto isolation N/A (de-id by design) |
| Improper alteration / late entry | late-entry module, `byte.amendment-not-erasure` | EDR audit-trail discovery is Curve’s domain |
| Unbounded negatives | vague absolute-negative phrases, `byte.bounded-negatives` | — |
| AI hallucination | `verifyMeaning()`, assist non-goals | — |
| Coding divergence | `justify.*` narrative support only | No claim/code bidirectional engine |
| Pharmacy controlled-substance red flags | — | **Parked** — not a dispensing system |
| Multi-state jurisdiction engine | TN + federal baseline | **Parked** — consult counsel for other states |
| Full medical CERT audit-packet mode | — | **Parked** — no Curve claim integration |

## Design rules already treated as hard constraints

The report’s twelve system rules map to existing rails (never invent facts; never
inflate certainty; never infer negatives from silence; never infer consent from
performance; never overwrite finalized notes; never send PHI to unapproved
endpoints). Smile Notes implements these via the transformer contract, PHI gate,
verifyMeaning, frozen submissions, and addendum workflow — not as marketing copy.

## Explicit non-goals (this digest)

- Pharmacy DEA / PBM red-flag documentation workflows
- CDT auto-coding or payer “audit packet” UI
- Multi-state legal checklist pretending to be universal
- User-facing “lawsuit-proof” or “litigation avoidance” language

## Related artifacts

- `knowledge/sources/litigation-documentation-research.md` — claim-file quantitative cohort
- `src/lib/audit/rules/completeness.ts` — anticipatory completeness rules
- `src/lib/advisor/knowledge.ts` — source-cited coaching
- `src/lib/assist/retrieval.ts` — consent / refusal / prescription retrieval cues
