# Adversarial hate — dental school faculty (checkbox medicine)

- **Type**: red-team / adversarial pedagogy review (not a live faculty interview)
- **Ingested**: 2026-08-08
- **Tags**: pedagogy, dental-education, checkbox-medicine, templates, attested-packs, gpa, favorites, clinical-reasoning, red-team
- **Status**: cruelty sheet for product honesty; pairs with other adversarial hate panels
- **Persona**: Mid-career dental school faculty — teaches clinical documentation, ethics of informed consent, and “write what you saw.” Believes Smile Notes trains **checkbox medicine** and **template laziness**. Hostile to Favorites culture, GPA theater, and attested packs that look like thinking.
- **Grounding**: shipped packs / Fast Lane starters, `deriveGpa`, badges, `VERIFIED_BLOCKS` assertion checkboxes, Curve Favorites benchmark digests. **Not** observed Cornerstone or dental-school sessions — hypotheses to falsify with associate/new-grad pilots.

## Axiom

You are not teaching documentation. You are teaching **how to satisfy a machine that grades completeness**.

**Why it matters:** Associates and new grads will copy what the chairside tool rewards. If Favorites-shaped packs + attestation checkboxes + a frozen GPA produce the highest score with the least patient-specific prose, the curriculum of the product is **click-through competence**. Faculty call that checkbox medicine. The chart looks adult. The reasoning never grew up.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Faculty who grades SOAP, consent conversations, and clinical rationale — not “Ready” chips |
| Skill | Clinical reasoning pedagogy; informed consent as dialogue; anti-template assessment design |
| Core hate | Attested packs that feel like Favorites; GPA that rewards cleared findings over thinking; Favorites culture imported from Curve and baptized as “standardization” |

---

## 5 pedagogical hates

### 1. Attested packs are Favorites with a honesty sticker

Fast Lane still adds **modules only**. Then matching published packs **offer** suggestable verified blocks — Yes / Not now — with per-block assertion checkboxes (`BlockRow` / `BlockPicker`). Placeholders block filing. Nothing silent-inserts. The engineering story is careful.

**Faculty read:** You rebuilt Favorites and called the click an **attestation**. The learner’s job becomes: apply pack → confirm every statement on the scaffold → fill angle brackets → file. That is **procedure compliance**, not “I examined this patient and decided X because Y.” The attestation checkbox trains the wrong motor program: *affirm the template* instead of *compose the finding*.

Worse pedagogically: Team Lead Workflow curates visit recipes of shipped blocks. The practice’s “standard note” becomes a **menu**. Curriculum dies when the house standard is a pack title, not a reasoning habit.

### 2. GPA is a grade for clearing detectors, not for clinical thought

`deriveGpa` weights Completeness 30 · Specificity 30 · Consistency 20 · Justification 20 from audit findings. It is **never a gate**. It **freezes** at filing. Improving the GPA and clearing the audit are “the same physical act.”

**Faculty read:** That is the confession. The score cannot be gamed except by writing a “better note” **as defined by the rule engine**. A student can learn to chase:

- kill `complete.*` / `required.missing`
- scrub vague / residue / abbreviation S2
- avoid anatomy / med-safety collisions
- satisfy `justify.*` when a procedure module is on

None of that requires a coherent Assessment → Plan chain in the learner’s own words. A pack-scaffolded note that clears detectors earns the letter. A sparse but honest reasoning note that trips residue or completeness while the writer is still thinking earns the F. You taught **exam-taking against an auditor**, not documentation as clinical communication.

### 3. Favorites culture is the disease you claim to cure

Repo digests admit Curve’s unfair chairside advantage is **Favorites + QuickText under the right visit**. Builder research explicitly aims to make verified blocks “as obvious as Curve’s Favorites.” Section starters, pinned MyBlocks, Fast Lane pack offers — all chase that muscle memory.

**Faculty read:** Favorites culture is how dental offices taught a generation that **the visit type writes the note**. Smile Notes inherits the culture and dresses it in placeholders and attestations. You did not reject Favorites. You **productized** it under practice packs. Every new associate who learned Favorites in school clinics or associate mills will feel at home — and never learn to narrate an atypical finding that no pack predicted.

### 4. Assertion checkboxes teach consent-and-care as a checklist ceremony

Verified blocks require every `verify[]` line checked before insert. Labels are real assertions (good engineering). Consent blocks, postop blocks, anesthetic blocks — all ride the same checkbox ritual.

**Faculty read:** Informed consent in school is a **conversation with a decision** (agreed / declined / deferred), not a stack of confirms that the scaffold is true. Checkbox ceremony is exactly the Doctors Company failure mode your own litigation digest names: form / checkbox theater without a reconstructible decision. You encoded the theater into the insert path and called it attestation. Learners practice **confirming language**, not **documenting dialogue**.

### 5. Badges and “Flawless Week” make template laziness a status game

GPA badges: Flawless Week (3.8+ across five filing days), Iron Mountain, Golden Syringe (perfect consistency), The Architect (perfect billing-narrative score). Economy bonuses attach.

**Faculty read:** You gamified **not getting caught by the rubric**. Consistency 1.0 means no medication-safety or anatomy finding survived — not that anesthetic documentation was educationally excellent. Architect rewards billing-narrative clearance — the axis most easily satisfied by pack language aimed at codes. Peer comparison is off the home screen (good), but the learner’s private dopamine still trains: **high GPA streak > patient-specific struggle**. That is pedagogical malpractice with sparkle.

---

## 4 curriculum-aligned fixes

Effort = invasiveness. Align to what faculty already grade: reasoning, specificity to *this* patient, consent-as-decision, and honest uncertainty.

| # | Fix | Hates | Curriculum map |
| --- | --- | --- | --- |
| **1** | **Mandatory visit-specific reasoning slot packs cannot fill** | 1, 3, 4 | After any pack / verified-block insert path, require a short **writer-authored** Assessment or clinical-rationale field (no suggestable block, no MyBlock paste for that slot on pack-started notes). Gate Copy/Submit on non-empty, non-placeholder, non-identical-to-scaffold text. Teaches: scaffolds structure; **you** own the why. |
| **2** | **Consent = conversation + decision, not verify-stack alone** | 4 | Consent insert must leave explicit **decision** and **patient-question / concern** slots that assertion checkboxes cannot satisfy. Storm: check-all verify + empty decision still stops. Maps to school OSCE consent stations, not form-signed theater. |
| **3** | **Replace GPA-as-identity with competency strip faculty would recognize** | 2, 5 | Keep frozen audit math if useful for Leads — but staff-facing finish shows **competency chips**: Findings present · Rationale present · Consent decision present · Imaging interpreted — pass/fail on killer pedagogy items, **not** a 3.82 letter. Park Flawless Week / Architect as Lead-only ops metrics or kill the badge copy that sounds like a transcript grade. Teaching signal ≠ school GPA cosplay. |
| **4** | **Pack provenance in the teaching debrief** | 1, 3 | On Training / after-filing supportive view: show which sentences came from pack/block vs free text. Faculty and mentors coach the free-text ratio and atypical findings. Measure **% of note characters from attested scaffolds** as a *warning* when high — never as a badge. Favorites culture becomes visible instead of invisible virtue. |

---

## The trap — standardized laziness with a diploma vibe

**Ship more attested packs, louder Favorites parity, and a prettier GPA — and call it documentation education.**

That photographs as rigor: placeholders, assertion checkboxes, frozen grades, Team Lead–approved recipes. Associates will clear the auditor, earn Flawless Week, and paste fluent pack prose into Curve.

Faculty will still fail the note in clinic: no patient-specific why, consent without a decision story, imaging “interpreted” by scaffold, anesthetic amounts filled because the bracket glowed. The product trained **checkbox medicine** at industrial scale while the litigation digests warn against exactly that failure mode.

Do not answer this hate by deleting scaffolds (chairside will revolt). Answer by making **thinking unskippable** and **GPA un-worshippable**. If the highest score is still available without a sentence only this patient could generate, the curriculum of Smile Notes remains template laziness with better CI.

---

## Explicitly do not ship (faculty hate)

- Silent Fast Lane clinical fill (Favorites without even the honesty sticker).
- Staff-authored freeform Forms fields the audit cannot see (dialect Favorites).
- Stronger GPA gates or hallway GPA leaderboards (turns pedagogy into ranking).
- More badges for pack adoption rate or “starter used” counts.
- Ambient / Care+ fluent filler sold as “helps students write” (invents soft tissue; kills reasoning practice).

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Pack-started notes with writer-owned rationale (≥1 non-scaffold sentence) | Rising | Pack → attest → brackets → Copy with empty why |
| Consent decision + concern slots filled when consent module/block used | Near 100% on export | Verify-all with empty decision |
| Staff-facing finish: competency killers vs letter GPA | Killers primary | 3.82 as the emotional finish |
| Scaffold character share on training notes | Visible; coached down when extreme | Hidden; badge-rewarded |

## Open questions for the owner

1. Accept a **forced free-text rationale** after pack starters (friction vs pedagogy)?
2. Demote letter GPA from staff finish UX to Lead digest only?
3. Is Training Arena the right place for pack-provenance debrief, or post-filing supportive band?

## Related

- `knowledge/sources/builder-text-blocks-predictive-ux.md` (Favorites chase)
- `knowledge/sources/team-lead-practice-packs-workflow.md` (attested scaffolds)
- `knowledge/sources/persona-training-corpus-research.md` (template culture / consent theater)
- `knowledge/sources/litigation-documentation-research.md` (consent checkbox theater)
- `knowledge/sources/check-your-note-ux-research.md` (finish discipline — complementary, not a GPA flex)
- `src/lib/gpa/deriveGpa.ts`
- `src/lib/stats/badges.ts`
- `src/lib/packs/packStartersForModules.ts`
- `src/components/standardize/BlockPicker.tsx`
