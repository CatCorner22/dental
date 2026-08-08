# Adversarial hate panel F — dental insurance / utilization review auditor

- **Type**: red-team / adversarial stakeholder simulation (not a live carrier interview)
- **Ingested**: 2026-08-08
- **Tags**: adversarial, insurance, utilization-review, upcoding, medical-necessity, billing-narrative, red-team
- **Status**: hypotheses to falsify; feeds hard-gate + GPA honesty backlog
- **Persona**: Utilization review / dental claim auditor. Looks for **upcoding narratives** and **thin medical necessity**. Paid to deny. Smiles at fluent emptiness.
- **Product under attack**: Smile Notes — note standardization beside Curve (paste/copy). Deterministic audit, modules, GPA stamp, completeness killers often S2 non-blocking, attested packs, no write-back.
- **Attack thesis**: The tool helps offices produce **fluent empty notes that look billable**.

## Axiom

Smile Notes does not invent CDT codes. It invents **confidence that the narrative will survive a desk review** — while leaving the necessity chain optional.

**Why it matters:** A plaintiff attorney cares about consent and wrong-site. A carrier auditor cares whether the **procedure string is justified by findings that only this patient had**. Fluent scaffold ≠ necessity. GPA ≠ payable.

---

## 5 hate bullets

1. **You grade grammar and stamp a GPA while medical necessity stays a courtesy flag.** Completeness killers (`complete.clinical-rationale`, imaging interpretation, consent substance) sit at **S2 — “Worth a look. Does not block.”** My denial letter writes itself: *note looks complete; chart does not establish why this code today.*

2. **Modules + attested packs are industrial QuickText with a halo.** Fast Lane dumps role-scoped scaffolds; optional pack starters still ship **pre-attested prose**. The office pastes fluent paragraphs into Curve. I read the same crown/SRP/extraction cadence across unrelated mouths. Pattern = upcoding signal, not quality.

3. **“Correct as written” is laundering for thin necessity.** Finding attestations stay **client-session state**, not a durable carrier exhibit. Staff clear the red light with a code that says the wording matches observation — while the observation still never names caries depth, pocket map, fracture plane, failed restoration, or failed conservative therapy. Checkbox ≠ clinical fact.

4. **No write-back is not integrity — it is a blind spot.** You never see the claim. Curve holds the CDT line; Smile Notes holds the pretty narrative. Offices can **align language to the fee ticket** without your product ever matching code↔finding. Paste/copy is the perfect crime scene: two systems, one story tailored for pay.

5. **Ready / GPA / frozen stamp teach the office that polish is the product.** `deriveGpa` says the score is never a gate — then you freeze a letter grade onto the filing like a report card. Utilization review does not grade style. We ask: **findings → diagnosis/decision → specific procedure → next step.** Your UI trains the opposite: clear S0/S1, ignore S2, copy, bill.

---

## 5 loopholes (how I win; how the office wins against patients and payers)

| # | Loophole | How the fluent-empty note ships |
| --- | --- | --- |
| **L1** | **S2 killers never block Copy/export** | `computeGates` ignores completeness killers. Office copies a “reviewed” note with missing rationale, missing imaging interpretation, thin consent. Curve chart looks finished; claim packet looks narrative-rich; necessity is absent. |
| **L2** | **Rationale regex is a keyword costume party** | `complete.clinical-rationale` wakes on procedure words and sleeps when certain justification tokens appear. Staff learn the magic nouns (“fracture,” “caries,” “failed”) without measurements, surfaces, failure timeline, or alternatives tried. Token presence ≠ necessity. |
| **L3** | **Attested packs scale sameness** | One Lead-approved pack → every crown prep sounds identical. On audit, identical narratives across DOS/providers are **cloned documentation**, a classic overpayment theory. Your “attested” label is practice process, not payer truth. |
| **L4** | **GPA justification axis ≠ CDT justification** | Justification subscore can rise from clearing unrelated findings or generic completeness while the **specific billed procedure** still lacks patient-specific indication. Letter grade on the stamp becomes exhibit A for “we documented carefully” — irrelevant to whether D2740 / D4341 / D7210 was indicated. |
| **L5** | **Deterministic language cleanup washes the smell without adding the meat** | Standardize / vocab passes make slang billable-looking (“SRP,” controlled abbreviations) without requiring periodontal chart cite, BOP, CAL, or radiographic bone loss tied to the quadrant claimed. Fluency up; substance flat. |

---

## 4 fixes that would block my audits (good for patients)

These hurt denial rates for **honest** care and starve upcoding theater. Ship them or keep feeding my queue.

1. **Hard-gate necessity killers on Copy/export** — Elevate at least `complete.clinical-rationale`, `complete.imaging-no-interpretation`, and consent substance killers so they **block** paste-out the way S0 anatomy already does. Hoisting in Check-your-note without a gate is theater I ignore.

2. **Procedure↔finding binding before Ready** — When a module/procedure family is active (crown, SRP, extraction, endo, implant), require **named, patient-specific indication fields** (site + finding class + why now), not free-text keyword luck. No indication → no Ready → no Copy. Patients get a real reason documented; I lose the thin-necessity deny.

3. **Freeze attestation onto the submission with code + who + when** — End client-session attest theater. Durable stamp: ruleId, attest code, clinician, timestamp, ruleset version. Prefer **independent verification** for necessity-killer attests (second named clinician). “Correct as written” alone must not clear rationale gaps.

4. **GPA honesty + anti-clone friction** — Never imply letter grade = payable/gate. Cap or hide GPA while open killers remain. Flag **high lexical overlap** against recent attested pack insertions for the same procedure family (warn staff; surface in Lead digest). Sameness becomes a coaching signal before it becomes my pattern review.

---

## 1 trap (what you must not ship)

**Trap: “Carrier mode” / billing-necessity AI that drafts indication language from the CDT line or the module name.**

That is upcoding automation with a compliance sticker. It invents the findings the claim needed. Plaintiffs and payers both feast. Your charter already forbids inventing clinical facts — keep it. Speed via Favorites clones is already dangerous enough; generative necessity is the product becoming my best witness against the office.

---

## Cross-links

- Rule surface: `src/lib/audit/killers.ts`, `src/lib/audit/rules/completeness.ts`, `src/lib/gpa/deriveGpa.ts`, `src/lib/standardize/reasonCodes.ts`
- Prior integrity frame: `knowledge/sources/documentation-integrity-deep-research.md` (billing-narrative risk)
- Litigation twin (different enemy, same S2 false confidence): plaintiff / completeness research in `knowledge/sources/litigation-documentation-research.md`

## Falsifiers (if you ever test this hate for real)

| Metric | Hate confirmed | Hate weakened |
| --- | --- | --- |
| Notes Copied with open `complete.clinical-rationale` / imaging killers | Flat after “Ready” UX ships | Falls only after hard-gate |
| Lexical similarity of crown/SRP packs across patients | High clone rate in Curve paste samples | Divergence after anti-clone friction |
| Denial overturn rate citing “documentation” | Offices wave GPA/stamp; still lose | Durable indication fields cited in appeals |
| Attest durability | Session-only; gone at claim time | Frozen on submission, retrievable |
