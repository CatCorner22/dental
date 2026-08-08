# Adversarial hate — TN Board of Dentistry investigator

- **Type**: red-team / adversarial simulation (not live Board contact)
- **Ingested**: 2026-08-08
- **Tags**: tennessee, board, compliance, supervision, pc1107, andon, clinical-role, privilege, evidence, red-team
- **Lens**: Investigator who has opened a complaint file. Does not care that the product is “honest.” Cares whether the **official chart** and the **software trail** invent compliance that never happened.
- **Grounded in code**: `src/lib/audit/rules/supervision.ts`, `src/lib/audit/engine.ts` (`computeGates`), `src/lib/auth/clinicalRoles.ts`, `src/lib/auth/approval.ts`, `src/lib/status/finishLine.ts`, builder Copy path vs Submit path.
- **Not** legal advice. Citations are the practice’s own digest level; verify official text before policy lock.

## Axiom

Smile Notes can manufacture a **compliant-looking paper trail** that a Board investigator will treat as **consciousness of the rule plus failure to meet it** — or worse, as a **falsified supervision claim** — while the practice pats itself on the back for “using the compliance tool.”

**Why it matters:** Curve is the chart the Board reads. Smile Notes is the rehearsal room with amber lights. If Copy ships a note that says Direct supervision while the dentist never saw the new patient, the Andon honesty doctrine is a **prop**. The investigator does not grade your UX. The investigator grades whether the record **lies**.

---

## 5 findings (mean)

### 1. PC1107 is a dropdown confession booth, not supervision proof

Public Chapter 1107 (effective 2027-01-01) requires **direct supervision by a dentist who has seen the new patient** before listed hygiene services. Smile Notes encodes that as: pick Patient status + Supervision; if New + General + listed module → finding.

**What the investigator sees:** Selecting **Direct** silences the rule. No named dentist. No “dentist examined this patient this visit.” No premises assertion. The composed note can leave the tool carrying a supervision label that **asserts the legal fact** with **zero corroboration**. That is not a hard stop. That is a **menu item that launders a claim**.

**Worse:** `computeGates` lets **Copy** through on **S1**. After the effective date, `supervision.pc1107-new-patient` is S1 — it blocks filing/email energy, **not** the clipboard into Curve. Staff can paste a General-supervision new-patient prophy into the official EHR while Smile Notes still “knows” the combination is unlawful. Two systems. One lie in the chart the Board subpoenas. One amber finding rotting in a side tool nobody opens at deposition.

**Module dodge:** Listed services are detected by module ids (`imaging`, `examination`, `periodontal`, `preventive`). Free-text “prophy / BWX / fluoride” without those modules = **silence**. The rule never wakes. The chart still documents the act.

### 2. Hygienist handoff Andon is theater next to an unlocked Copy door

The finish line correctly says **“Dentist must file — transfer ownership first”** when filing authority fails. Status can show **Handoff**. Assessment/Plan can read **Waiting for dentist**.

**What the investigator sees:** The hygienist still **Copies for Curve** when export is allowed (S0-clear). The official patient record receives polished prose. Smile Notes retains a draft that never froze under a dentist license. The Andon told the truth **inside the wrong building**. The Board reads Curve. Curve does not care that your chip said Handoff.

Lead-only transfer makes it worse: Lead is at lunch → hygienist cannot transfer → paste bypass → dentist never reviewed → note looks complete in the PMS. Honesty doctrine forbade a fake Transfer button. It did **not** forbid a fake **complete chart**.

### 3. Unset clinical role is an open license with a courtesy amber slab

`canRecordClinicalJudgement("unset")` is **true**. `checkFilingAuthority("unset")` is **allowed**. Scope locks stay open. The Andon scolds: role not recorded; ask a Team Lead.

**What the investigator sees:** Diagnosis and plan filed by accounts the practice **refused to classify**, while marketing (and Risk Management copy) implies Tennessee scope is enforced. The amber card is not a gate. It is a **greeting**. Every unset-authored assessment is an exhibit: the tool *could* bind licenses to writers; the practice *chose* the load-bearing default that restricts nobody. “We use Smile Notes for compliance” becomes **knowing non-configuration**.

### 4. Attorney-client is not a force field around Board evidence

Patient notes, Curve charts, frozen submissions, ruleset versions, and “who attested what when” are **practice records and Board evidence**, not a conversation with counsel. Risk Management checklists in `localStorage`, training arena passes, digests, and “we ran the audit” screenshots do not transmute a thin chart into privileged work product.

**What the investigator sees:** Counsel may claim privilege over **legal advice**. Counsel does **not** get to hide the clinical record behind “our compliance software flagged it.” If the software raised PC1107 / completeness killers and staff attested past them or Copied anyway, that trail is **consciousness + override**, not a privilege cloak. Calling the audit log “QA” does not erase it. Telling the Board “Smile Notes said we were fine” when Copy never required Direct-supervision corroboration is a **false exculpation**.

### 5. Compliant *language* without compliant *facts* is the product’s favorite sin

The transformer’s invariant — never change what a note says — is correct for language. The Board is not investigating diction. The Board is investigating **whether a dentist who had seen the new patient was directing that prophy**. Smile Notes can standardize “Direct — dentist on premises” into beautiful controlled vocabulary while the schedule shows the DDS in another operatory on another patient who was never examined. Pretty notes. Dead supervision. The paper trail looks *more* compliant than a sparse Curve QuickText — which makes the falsity **louder**, not quieter.

---

## 4 fixes (ship or admit you are theater)

### Fix A — PC1107: claim ≠ evidence

After 2027-01-01, for New patient + listed hygiene service:

1. Supervision alone does **not** clear the rule.
2. Require affirmative fields the Board can read: **named supervising dentist**, **dentist examined patient this visit (yes/no)**, and if yes, a short **when/how** that is not a silent default.
3. **Block Copy and Submit** (export gate, not advisory) until those fields clear — S1 that cannot leave the tool by clipboard.
4. Keep module detection; add text-signal storm tests so free-text prophy/BWX/fluoride cannot dodge the modules forever.

Bump `RULESET_VERSION`. Storm first: Direct-with-no-exam, General-with-Copy, module-less free text, pre/post effective date.

### Fix B — Handoff Andon owns the clipboard

When `filingAllowed === false`, **Copy/download are locked** the same way Submit is — or the paste packet is unusable as a final chart (explicit **NOT FILED — dentist review required** banner that survives paste and cannot be toggled off by the hygienist). No more “honest chip, dishonest EHR.” Owner policy lock: lock Copy vs watermark. Pick one. Half-ship is still theater.

### Fix C — Unset role hard-gates judgment and filing

Abandon the load-bearing open default for any pilot that claims scope enforcement:

- `unset` **cannot** write Assessment/Plan.
- `unset` **cannot** file.
- Monday readiness: coordinator sees unset writers **before** open; Andon is not the first emotional beat of the shift.

Amber without a gate is branding.

### Fix D — Privilege hygiene vs Board production

Write practice policy in one page of English Adams would not sue:

- **Board / patient record production** = Curve chart + Smile Notes frozen submissions (if used as record support) + attribution.
- **Counsel work product** stays with counsel — never pasted into clinical notes, never stored as “Risk Management completed” proof of compliance.
- Attestations and killer overrides remain **discoverable clinical-process facts**, not privileged QA cosplay.
- Never instruct staff that “Smile Notes cleared it” is a defense. The note either documents the required facts or it does not.

---

## 1 trap (do not take the bait)

**Trap: Add a “Dentist saw patient ✓” checkbox that auto-sets Supervision to Direct and unlocks Copy.**

That is how you upgrade soft theater into **documented falsification**. The investigator will not thank you for the extra field. The investigator will ask who checked it, whether the dentist was on the premises, and why the schedule contradicts the note. A checkbox is cheaper than presence. Presence is the law. Software that rewards the checkbox is **co-counsel for the complaint**.

Same family of trap: telling staff that internal Risk Management ticks or attorney review of the *tool* make the *patient chart* privileged. They do not. The Board reads the chart. Your feelings about attorney-client are not in Rule 0460-02-.12.

---

## Evidence map (for falsification)

| Claim | Code / surface |
| --- | --- |
| Direct silences PC1107 without exam proof | `supervision.ts` — only compares select strings |
| S1 does not block Copy | `computeGates` — `exportAllowed` ignores S1 |
| Handoff chip + Copy still open | `finishLine` / `draftStatus` vs builder export buttons gated on `exportAllowed` only |
| Unset files and diagnoses | `clinicalRoles.ts`, `approval.ts` |
| Risk checklists ≠ Board record | `RiskManagement.tsx` localStorage |

## Related

- `knowledge/sources/tn-des12-legal-blueprint.md` (PC1107 source)
- `knowledge/sources/go-live-ux-command-check.md` (handoff honesty without fake Transfer)
- `knowledge/sources/check-your-note-ux-research.md`
- `knowledge/sources/litigation-documentation-research.md`
