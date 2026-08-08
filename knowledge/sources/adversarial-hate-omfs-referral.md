# Adversarial hate panel — OMFS / specialist receiving GP referrals

- **Type**: red-team / adversarial stakeholder simulation (not a live interview)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, referral, omfs, specialty-handoff, imaging, clinical-rationale, red-team
- **Status**: fix backlog ready; killer-set / hard-gate items need owner policy lock
- **Method**: One hostile mock agent — oral & maxillofacial surgeon (or peer specialist) who lives on incomplete handoffs from general practices that use Smile Notes. Instructed to **hate** thin referral notes, attack the referral block, thin rationale, and missing imaging interpretation. Grounded in shipped surfaces (`referral` verified block, `complete.referral-loop-open`, `complete.imaging-no-interpretation`, `complete.clinical-rationale`, Check-your-note killer hoist). **Not** observed Cornerstone→specialist traffic — hypotheses to falsify against real outbound referral packets.

## Axiom

A specialist does not need Smile Notes to feel clever. They need the **finding, the interpretation, the ask, the urgency, and the records** — or they re-work the case cold and the GP’s “standardized” note becomes evidence of a **careless handoff**.

**Why it matters:** Inside the GP office, staff hate speed tax. Across the referral wall, the specialist hates **reconstruction tax**. If Smile Notes ships a referral that still reads “Referral placed,” you did not close a loop — you printed a shrug.

## Persona

| Field | Value |
| --- | --- |
| Role | OMFS / specialty receiving referrals (also hits endo, perio, ortho consults the same way) |
| Skill | Reads referral packets under clock pressure; reconstructs risk before first incision / consult |
| Personality | Hostile to template theater; zero patience for “we documented something” |
| Core hate | Incomplete handoff notes from GPs using Smile Notes |

## 5 hates

### 1. Referral block that flatters the writer and starves the recipient

The verified block (`referral`) asks for specialist, reason, what the patient was told, and records to forward. The universal-core field still offers **`None.`** as a standard phrase and accepts narrative scraps. Outbound reality: “Referral placed.” / “Referred to oral surgery.” No named practice, no tooth/site, no ask (“extract vs expose vs observe”), no timeframe, no packet list. The block exists. The handoff does not.

### 2. Thin clinical rationale dressed as a plan

`complete.clinical-rationale` fires on procedures without why. Referral notes still arrive as billing-adjacent prose: “#17 extraction — refer OMFS.” No non-restorable finding, no symptom timeline, no failed attempt, no medical modifier that changes surgical plan. Doctors Company gap #3 travels across the fax line. The specialist inherits a **procedure label**, not a **reason for care**.

### 3. Imaging without interpretation (films ≠ findings)

`complete.imaging-no-interpretation` is already a Check-your-note killer — and still the specialty inbox fills with “PANO taken, refer to OS” and a disc or upload with **no dentist-stated findings**. Impacted? Caries to furcation? Proximity to IAN? Pathology vs normal follicular space? An image without interpretation is an image nobody owned. Sending the file does not send the read.

### 4. `complete.referral-loop-open` is soft where the specialist needs steel

The rule correctly flags “Referral placed” without recipient/reason — then `satisfiedBy` accepts weak cues (`specialist`, `for evaluation`, a specialty noun). Check-your-note **killer hoist omits** `complete.referral-loop-open` entirely (`KILLER_RULE_IDS` has imaging + rationale, not referral-loop). Copy can look serious while the outbound loop is still open. Specialty care is downstream of that miss.

### 5. False confidence on the GP finish path

Ready / Handoff chips, GPA energy, and a killer summary that never asks “what does the OMFS need tomorrow morning?” train the GP team that the note is done. The specialist’s first five minutes become chart archaeology: call the office, re-image, re-consent, delay surgery. Smile Notes optimized the **writer’s exit**, not the **recipient’s entry**.

## 4 fixes

| # | Fix | Attacks hates | Notes |
| --- | --- | --- | --- |
| **1** | **Specialty referral packet gate** — before Copy/export when referral language or the referral field is active, require four explicit slots: **to whom**, **clinical ask** (finding → requested action), **urgency**, **records forwarded** (imaging + note). Map onto the existing `referral` block; refuse `None.` as a filled referral. | 1, 4, 5 | UI + light rules. Elevate `complete.referral-loop-open` into `KILLER_RULE_IDS`. Tighten `satisfiedBy` so “specialist” alone does not close. |
| **2** | **Imaging interpretation hard-stop on referral path** — if imaging was acquired (or attached as “records to forward”), block referral Copy while `complete.imaging-no-interpretation` is open. Prefer dentist-attributed findings from the `radiograph-interpretation` block. | 3, 5 | Aligns with hate-panels P1 hard-gate; referral path is the highest-ROI place to start. Policy lock if this should block all Copy, not only referral. |
| **3** | **Rationale travels with the ask** — referral finish summary hoists `complete.clinical-rationale` beside the referral slots: one line that ties **finding/diagnosis → why specialty → what you want back**. No new clinical invention — only force the chain the Doctors Company cohort keeps losing. | 2, 1 | Reuse Check-your-note rows + Change links into rationale / referral fields. |
| **4** | **Specialist-facing readback (plain packet preview)** — one scannable preview the GP sees before Copy: tooth/site, interpretation summary as written, ask, urgency, records list, what patient was told. Same words as the note — reorder for the recipient, do not rewrite meaning. | 1, 3, 5 | Paste-friendly; still no Curve write-back. Adversarial test: sparse “Referral placed” cannot reach clipboard. |

## Trap

**Do not auto-author the specialty narrative.** The fatal “fix” is ambient / assist fill that invents OMFS-ready prose (“3 mm from IAN,” “non-restorable,” “STAT cellulitis”) from module checks, codes, or an image flag the dentist never stated. That buys Favorites speed, launders thin GP judgment into a confident specialist packet, and hands plaintiff counsel a fabricated handoff. Same class of trap as silent Fast Lane dump and Forms clone — worse here, because the recipient acts on it.

Also reject: soft training mode that lets “Referral placed” graduate; treating patient-portal summary tone as the specialist packet; AI referral letters that outrun `verifyMeaning()`.

## Grounding (code / rules already in repo)

| Surface | Location | Specialist read |
| --- | --- | --- |
| Referral verified block | `src/lib/phrases/blocks.ts` (`referral`) | Right questions; optional in practice |
| Radiograph interpretation block | `src/lib/phrases/blocks.ts` (`radiograph-interpretation`) | Attribution required — keep it |
| Referral field default phrase | `src/lib/modules/universal-core.ts` (`None.`) | Actively hostile to outbound quality |
| Referral loop rule | `complete.referral-loop-open` | Good trigger; weak satisfaction; not in killer hoist |
| Imaging / rationale killers | `complete.imaging-no-interpretation`, `complete.clinical-rationale` | In `KILLER_RULE_IDS`; still S2, not Copy hard-gate |
| Advisor | `byte.referral-loop` | Coaching only — specialist never sees it |

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Outbound notes with referral language missing to-whom **or** clinical ask | Falls after fix #1 | Flat while UI “looks Ready” |
| Referral Copy with open imaging-interpretation killer | → 0 on referral path | Any |
| Specialist call-backs for “why referred / what did the film show” (manual log in pilot) | Down | Unchanged |
| Median GP ready→Copy time on referral visits | ≤ +20% | Persistently slower → bypass to Curve QuickText one-liners |

## Open questions for the owner

1. Hard-gate referral packet + imaging interpretation on **referral Copy only**, or on every Copy once referral language appears?
2. Is `complete.referral-loop-open` promoted to killer hoist (UI) first, or straight to Copy block (policy)?
3. Who is accountable when hygiene drafts the referral text and the dentist only hits Copy — same DDS killer-only path as hate panels P0 #2?

## Related

- `knowledge/sources/adversarial-hate-panels.md` (office-side hate; this brief is the **recipient** wall)
- `knowledge/sources/litigation-documentation-research.md` (referral / delayed-diagnosis patterns)
- `knowledge/sources/check-your-note-ux-research.md` (killer hoist; referral-loop gap)
- `src/lib/audit/rules/completeness.ts`, `src/lib/audit/killers.ts`, `src/lib/phrases/blocks.ts`
