# Carrier underwriting attack — Smile Notes false confidence (Ready / GPA / S2 killers)

- **Type**: adversarial stakeholder simulation (malpractice carrier risk manager / underwriter)
- **Ingested**: 2026-08-08
- **Tags**: litigation, underwriting, malpractice, false-confidence, ready-chip, gpa, s2-killers, risk-reduction
- **Status**: underwriting requirements brief; not live carrier correspondence
- **Method**: Hostile risk-manager persona. Goal = fewer claims paid, not product delight. Grounded in shipped gate semantics (`deriveDraftStatus`, `deriveGpa`, `KILLER_RULE_IDS`, S2 “does not block”) and claim-file research in `litigation-documentation-research.md`. **Not** a quote from MedPro / Doctors Company underwriting manuals.

## Axiom

A green Ready chip, a letter grade, and a checklist labeled “killer” that still lets Copy through after a click is **risk theater**. Preferred rates require proof that litigation-grade gaps cannot leave the tool looking finished.

**Why it matters:** Insureds will treat your UI as a safety system. If deposition counsel can show “Ready / A / killers acknowledged” next to a MedPro-sparse chart, you coached false confidence — and we price that.

---

## Five underwriting concerns (ranked by claim harm)

### 1. S2 “killers” that do not kill (highest)

**What we see:** Completeness killers that dominate closed-claim documentation gaps — anesthetic amount, imaging interpretation, consent decision / thin assertion, clinical rationale — stay **S2**. Product copy itself says Review does not block. Check-your-note can require acknowledgment; `computeGates` still does not treat those IDs as hard stops. Anatomy wrong-site is S0; the claim-file content gaps are not.

**Claim path:** Associate pastes “RCT complete #30 with local” after clicking through a killer ack. Years later, expert cannot reconstruct dose, consent conversation, or rationale. Defense pays on documentation compound even when clinical care was defensible.

**Underwriting read:** You named the landmines and left the detonator optional. That is worse than silence — it proves the practice knew the gap class and shipped past it.

### 2. Ready chip = audit silence, not defensibility

**What we see:** `Ready to submit` means no S0/S1, no open S2 count, filing role allowed. It does **not** mean another dentist can reconstruct the visit. Regex-clean notes still miss judgment, disposition, referral loops, and conversation substance the rules never catch. Role handoff honesty (hygienist ≠ Ready) is necessary; it is not sufficiency.

**Claim path:** Jury / expert sees a green finish signal in screenshots or training lore. Plaintiff frames the tool as the practice’s own quality seal on a thin chart.

**Underwriting read:** Andon that only encodes severity counts will green-light thin-but-clean notes. We underwrite reconstruction risk, not chip color.

### 3. GPA / ring as comfort grade beside a non-gate

**What we see:** Code correctly states GPA is **never** a filing gate and is frozen at submit. Axes blend completeness / specificity / consistency / justification. A note can look “B” / respectable while still carrying soft attestation history, thin consent that barely cleared, or prior-session coaching ignored. Staff and owners will still treat the letter like a report card.

**Claim path:** Discovery produces GPA stamps or dashboard rings. Counsel asks: “Your system graded this note. Where is the anesthetic amount?” Grade becomes exhibit for institutional knowledge of standards without institutional enforcement.

**Underwriting read:** Any visible score that is not bound to open litigation killers is a deposition gift. Prefer hide, or bind letter display so open killer-class gaps cannot look like an A/B win.

### 4. Attestation / ack theater without durable identity

**What we see:** Fix-or-attest and killer acknowledgment can clear the human’s path without fixing the chart. Client-session attest without durable **who / when / reason code** frozen on the filed artifact is checkbox theater. Independent verification for killer-class attest and PHI override is optional policy, not product mandate.

**Claim path:** “Correct as written” after a completeness killer is the plaintiff’s favorite stamp — it converts omission into affirmative endorsement.

**Underwriting read:** We price overrides that lack named clinician, timestamp, controlled reason code, and (for killer class) second verifier. Soft ack is not risk transfer.

### 5. Two-app paste gap + bypass incentive (compounder)

**What we see:** Charter forbids EDR write-back. Copy → Curve (or Favorites) remains the record of truth. Associates under load will bypass Smile Notes when finish path feels like nanny software; then neither Ready nor GPA nor killers touched the chart that matters.

**Claim path:** Tool metrics look clean (or unused). Curve holds the sparse Favorite. Underwriting cannot credit a control that high-volume operators skip.

**Underwriting read:** Adoption failure is a control failure. Preferred rates need evidence that killer gaps cannot Copy out, and that the dentist path is fast enough that bypass is irrational — not a training memo.

---

## Product requirements we would mandate for preferred rates

Ranked. Non-negotiable for credit; theater below does not substitute.

| Rank | Mandate | Why we care | Evidence we would demand |
| --- | --- | --- | --- |
| **1** | **Hard-gate litigation killers on Copy / export / submit** — anesthetic amount, imaging interpretation, consent+decision (incl. thin assertion), clinical rationale, wrong-site / dose-max class. Ack alone is insufficient. | Closes the MedPro/Doctors Company documentation gap set at the moment text leaves the tool. | Ruleset + gate tests: sparse operative note cannot reach clipboard; RULESET_VERSION stamped on filings. |
| **2** | **Freeze attestation identity on the filed artifact** — reason code + named clinician + timestamp; immutable with the note text. No client-only ack. | Turns override from theater into reconstructible evidence (or into a red flag we can count). | Submission schema sample; audit sample of override rates by code. |
| **3** | **Independent verification for killer-class attest and PHI override** — second named clinician, separated in workflow. | Stops self-laundering of the exact gaps that lose claims. | Policy + product path; exception log; Lead coverage plan for multi-office bottleneck. |
| **4** | **GPA / Ready honesty contract** — Ready never implies defensibility; GPA never displayed as a pass; hide letter or bind display so open killer-class findings cannot read as A/B comfort. Staff copy forbids “safe / compliant / lawsuit-proof.” | Removes deposition exhibits that overclaim. | UI screenshots + copy review; adversarial tests that thin notes cannot look finished. |
| **5** | **GOV.UK-style Check-your-note with Change links** before Copy — killers hoisted, not buried in Sidekick; Change jumps to field. | Reduces time-pressure miss of known gaps. | Finish-summary tests; metric: share of notes exporting with open killers without Change falls. |
| **6** | **DDS killer-only handoff path** — hygienist builds; dentist sees ≤ few open killers + fast Copy; no full Audit sermon on every associate finish. | Adoption is a control. Slow nanny → Curve Favorites only. | Time-to-Copy vs Favorites; bypass rate. |
| **7** | **Practice filing rollup** — modules + finding categories + override reason codes; **no** peer scoreboards. Quarterly underwriting packet optional. | Lets us see whether gates bite or staff click through. | De-identified aggregate export; trend after hard-gate ship. |
| **8** | **Shared-device author lock + draft survivability** — wrong-author and wifi-loss are pilot kill criteria for us too. | Misattribution and reconstructed-from-memory notes are claim fuel. | Session switch proof; recovery demo. |

**Preferred-rate kill switches (any one):** soft “training mode” that disables hard stops; silent Fast Lane / ambient fill of clinical facts; marketing that promises fewer lawsuits; GPA used as a gate that can disagree with audit gates.

---

## Theater we ignore (do not spend premium credit here)

We will not discount for:

- Cream Daylight skins, motion polish, brand-first login, display typefaces
- GPA rings, stars, cheer, letter grades as “culture”
- Long advisory essays, unread digests, peer leaderboards
- Killer **labels** without hard gates
- Killer **acknowledgment** without durable who/when/code
- Soft amber “Review suggested” copy that never blocks Copy
- Ambient / Care+-style invented findings sold as documentation quality
- Curve write-back roadmaps (architecture fantasy; we underwrite the chart that exists)
- MFA theater as a substitute for clinical completeness gates
- Claims that better notes **prevent** lawsuits (negative proof; we price gap reduction and reconstructibility, not miracles)

Honesty we already like and still will not pay for alone: PHI hard stops, wrong-site S0, meaning-preserving transformer discipline, frozen historical filings, no silent clinical invention. Those are table stakes — not preferred-rate upgrades — until killers that match claim files actually block exit.

---

## Deposition one-liners we are preparing (if you ship status quo)

1. “Your software called these items killers and still let the note leave after a click.”
2. “Ready meant the regex queue was empty — not that the visit was reconstructible.”
3. “You graded the note. Where is the anesthetic amount and the consent conversation?”
4. “Correct as written on a completeness gap is an endorsement, not a defense.”
5. “The chart of truth is still the EDR Favorite your associate typed in twelve seconds.”

---

## Related

- `knowledge/sources/adversarial-hate-panels.md` (plaintiff panel B — same false-confidence theme)
- `knowledge/sources/check-your-note-ux-research.md`
- `knowledge/sources/litigation-documentation-research.md`
- `knowledge/sources/high-stakes-documentation-patterns.md`
- `src/lib/audit/killers.ts`, `src/lib/status/draftStatus.ts`, `src/lib/gpa/deriveGpa.ts`, `src/lib/audit/types.ts` (S2: does not block)
