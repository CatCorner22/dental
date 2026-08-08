# Adversarial hate → Co-Design — Honest Finish

- **Type**: co-design workshop with hostile mock agents (not live Cornerstone interviews)
- **Ingested**: 2026-08-08
- **Tags**: ux, co-design, adversarial, finish-line, accessibility, labor, litigation, hipaa, adoption
- **Status**: feedback closure complete; ship-now slice implemented on this branch
- **Upstream hate pool**: `adversarial-hate-panels.md` / PR #110 (24 lenses)

## Cohort — top 12 (intelligence × anger)

Selected from the hate pool for sharp systems reasoning **and** refusal energy:

| # | Lens | Why seated |
| --- | --- | --- |
| 1 | Plaintiff attorney | Deposition-grade false-confidence attack |
| 2 | Malpractice carrier UW | Prices Ready/GPA theater |
| 3 | TN Board investigator | Reconstructability / attribution |
| 4 | Cynical associate DDS | Dentist-owned killers / paste tax |
| 5 | Burned RDH (labor) | Walkout on scoreboards / Soft S2 unpaid labor |
| 6 | Chairside DA | Glove + drill reality |
| 7 | A11y / motor / low-vision | Default-path AA |
| 8 | CVD + dyslexia writer | Hue/microtype/essay failure |
| 9 | Practice IT / HIPAA | Shared identity / clipboard / draft mirrors |
| 10 | Curve Hero power user | Favorites 90s race |
| 11 | Practice owner | ROI vs Daylight-as-strategy |
| 12 | Dental school faculty | Checkbox medicine / attested packs |

Workshop ran as three mediated tables (legal-risk · chairside-a11y · ops-buyer), then one binding contract.

---

## Binding experience contract

### Name

**Honest Finish** — also signed as *“Ready Means What It Says”* and *“Copy-ready, not score-ready.”*

### Axiom

**Ready cannot mean safe when unresolved risk items remain.** Copy may stay available under Soft S2 policy; the finish surface must never look finished.

### Why it matters

False confidence is a deposition exhibit, an underwriting penalty, a Board reconstruction gap, and a labor walkout trigger. Pretty is not the adoption plan.

### Shared primary flow (signed)

1. Write the note (glove-sized targets on the default path).
2. Short stop cards: What / Why / How — no Andon essays.
3. Clear true blockers (S0/S1). Soft S2 warns; Copy not unpaid homework.
4. Open killers require explicit ack on the Copy confirm (existing soft gate — stated plainly).
5. Unset clinical role blocks Copy/File until a Lead records the role (authorship checkpoint).
6. Copy for Curve is intentional clipboard egress; local draft mirrors wipe on sign-out.
7. No GPA, peer rank, Forms clone, or ambient AI on the clinical path.

### 90-second honesty test (ops-buyer table)

Pass only if one real visit flow beats Favorites **and** catches a consent/risk/findings gap Favorites would miss. Fail = optional polish.

---

## Feedback closure (material contributions)

| Contribution | Source table | Disposition | Follow-through |
| --- | --- | --- | --- |
| Never say “Ready to file” while S2/killers remain open | Legal | **Adopted** | `builderFinishLine` + review chip wording |
| Keep Soft S2 from blocking Copy; warn only | Chairside / RDH | **Adopted** | No `computeGates` change; finish copy states risk |
| Killer ack before Copy confirm | Legal (already shipped) | **Kept** | Honesty banner on finish line when ack required |
| Role before Copy/File (not full role-before-work) | Legal Adopt / Board longer-term | **Adopted** (Copy/File gate) | BuilderShell + finish line; full role-before-work stays **policy lock** |
| Hard-block all killers including S2 | Plaintiff dissent | **Policy lock** | Owner/counsel |
| Hard shared-iPad author switch | IT / OM | **Deferred / policy** | Wipe mirrors on sign-out shipped; per-patient lock later |
| 44px targets by default (not only `pointer: coarse`) | Chairside / a11y | **Adopted** | `globals.css` + ToothPicker floor |
| ProgressRing not hue-only | CVD | **Adopted** | Shape glyph + state word in `aria-label` / visible marker |
| Reduced motion kills transforms | A11y | **Adopted** | `.sparkle-pop` disabled under reduced-motion |
| Short Andon stop cards | CVD / swarm | **Adopted** | Unset-role card shortened |
| Clear draft mirrors on sign-out | IT | **Adopted** | `clearAllDraftBackups` + SignOutButton |
| Strip GPA from finish path | All tables | **Already true** | Keep; do not surface letter grades near Copy |
| Peer scoreboards | RDH / faculty | **Rejected** | Hard non-goal |
| Ambient AI / Forms clone | All | **Rejected** | Charter |
| Fast Lane must beat Favorites with sentences | Curve / owner / faculty | **Deferred** (product proof) | Measure in pilot; pack sentence quality backlog |
| MFA-on production | IT | **Policy / ops** | Deployment flag — not a UI PR |
| Dentist owns hygiene Assessment killers before Copy | Associate DDS | **Adopted** (Copy ownership gate) | `copyOwnership.ts` + BuilderShell Andon/transfer |

---

## Open dissent (preserved — Van Riper)

- **Plaintiff:** still wants every killer hard-blocked.
- **Board:** still wants role-before-work, not only Copy/File.
- **RDH:** still distrusts post-file GPA/badge economy — keep it off the clinical path.
- **Curve power user:** will not adopt until 90s Favorites race is measured in-office.
- **IT:** clipboard egress remains a residual risk even with intentional Copy.

---

## Ship-now slice (this PR)

| Change | Files |
| --- | --- |
| Finish line honesty (no Ready with open review/killers) | `finishLine.ts` + tests, `BuilderShell` wiring |
| Review status chip wording | `draftStatus.ts` |
| Role gate on Copy/Submit when unset | `BuilderShell.tsx` |
| Glove-default 44px targets | `globals.css`, `ToothPicker.tsx` |
| ProgressRing shape + text state | `ProgressRing.tsx` + tests |
| Sparkle transform off under reduced motion | `globals.css` |
| Wipe all local draft mirrors on sign-out | `draftBackup.ts`, `SignOutButton.tsx` |
| Readable severity chip type on Check-your-note | `CheckNoteSummary.tsx` |
| Short unset-role Andon | `BuilderShell.tsx` |
| Unresolved-risk honesty banner on killer ack | `CheckNoteSummary.tsx` |
| Audit finding jump as real `<button>` (keyboard) | `AuditPanel.tsx` |
| Aux + dentist-judgement killers block Copy | `copyOwnership.ts`, `BuilderShell.tsx`, `finishLine.ts` |

**Not in this slice (policy locks):** hard-gate S2 killers, MFA enforcement, SSO, per-patient author lock, IV path, Favorites race instrumentation.

---

## Acceptance tests (falsifiers)

- Finish line never contains “Ready” when open killers require ack or S2 reviews remain.
- Unset role: Copy and Submit stay locked; finish line names the role gap.
- ProgressRing `aria-label` includes a non-color state word (Stop / Required / Review / Ready / Handoff).
- `prefers-reduced-motion`: `.sparkle-pop` has `animation: none`.
- Sign-out clears local draft backup keys.
- Soft S2 still does not flip `computeGates.exportAllowed` by itself.
- Glove CSS: `.chip` / `.tap` / `.tap-sq` carry 44px mins without requiring `pointer: coarse`.
