# Team Lead practice packs — predictive text, approvals, and history

- **Ingested**: 2026-08-06
- **Kind**: product research + workflow design (not shipped)
- **Question**: How do we make Smile Notes a chairside time-saver with pre-populated / predictive text, while letting Team Leads run an in-app workflow with approvals and a visible change history?
- **Confidence**: High for what the code does today (traced). Moderate for industry template risk (ADA + claim-file digests). Design proposal is a recommendation, not a commitment.

---

## 1. Plain answer first

**Predictive text here means ranked menus of attested scaffolds — not the computer writing clinical truth.**

Team Leads should curate **practice packs** (visit-type menus of shipped verified blocks + Fast Lane modules). They should **not** invent freeform Curve Forms fields the audit cannot see.

Every pack change needs: draft → review → approve → publish, with a history of who changed what.

---

## 2. What exists today (gap map)

| Need | Today | Gap |
| --- | --- | --- |
| Pre-populated text | `VERIFIED_BLOCKS`, phrase chips, MyBlocks, Section starters (PR path) | Practice cannot author or reorder packs in-app |
| Predictive ranking | `suggestedBlocksFor` (deterministic) | No practice override of ranking |
| Team Lead role | Ops: users, transfers, wishes, store, digest, Gauntlet email | **Zero write path** into vocabulary / blocks / packs |
| Approvals | Store redemptions; wish status; dentist **files** (not a queue) | No pack approval queue |
| History | `audit_log` (manager+ UI); wishes/store overwrite decisions | No before/after pack history Team Leads can see |
| Learning | `proposals.ts` — observe only; “NOTHING HERE APPLIES ITSELF” | Proposals never persist as ratified pack diffs |

**Hard rails that kill unsafe designs**

1. Team Lead must not write other people’s clinical notes (`canWriteNote`).
2. No parallel dentist “approve checkbox” for filing — the dentist files (`approval.ts`).
3. No practice Forms authoring — audit-blind dialects (`smile-notes-vs-curve-hero.md`).
4. No inventing findings, copy-forward, ambient AI, silent Fast Lane fill.
5. Vocab/rules change via versioned, human-ratified table diffs (`RULESET_VERSION` / learning ledger).

---

## 3. Industry lesson (why “pre-populated” fails)

ADA + claim-file research: templates and smart phrases help **only when** the note stays patient-specific. Failure modes Smile Notes already resists:

- Click-through required fields with recycled language
- Copy-forward of yesterday’s note
- Care+-style fluent filler that invents soft tissue / consent
- Staff-built Forms fields the checker never sees

**Safe pre-population** = insert a scaffold with `<placeholders>` + assertion checkboxes.  
**Unsafe pre-population** = filled clinical sentences that look done.

---

## 4. Proposed product: Practice Packs Workflow (Team Lead+)

### 4.1 What a pack is

A **Practice Pack** is a named visit recipe:

- Fast Lane module set (structure only)
- Ordered list of **existing** `VERIFIED_BLOCKS` ids (short suggestable set preferred)
- Optional phrase-stem pins (from shipped `standardPhrases`, not free prose)
- Role filter (who may see the pack: hygienist / assistant / dentist)
- Version number + `publishedAt`

**Forbidden in v1:** new freeform clinical paragraphs authored by the practice; new audit fields; auto-insert on Fast Lane tap.

### 4.2 Workflow states (Andon-visible)

```
draft → in_review → approved → published
                 ↘ rejected → draft
published → (edit creates new draft revision) → …
```

| State | Who | Meaning |
| --- | --- | --- |
| `draft` | Authoring Team Lead | Editable; staff do not see it |
| `in_review` | Second Team Lead+ (not author) | Approve / reject with note |
| `approved` | System | Ready to publish; optional cool-off |
| `published` | System | Live for matching roles; stamps pack version into note metadata when used |
| `rejected` | Reviewer | Back to author with reason |

**Self-approve blocked** (same rule as store redemptions).

### 4.3 History (genchi — show the real change)

Append-only `practice_pack_events`:

- `at`, `actorId`, `actorName`, `action` (`created` / `submitted` / `approved` / `rejected` / `published` / `retired`)
- `fromVersion`, `toVersion`
- `diffJson` — before/after block order + module ids (no clinical free text invention)
- `decisionNote`

Team Lead UI: **Workflow → Practice packs → History** shows this table. Optionally mirror summary lines into `audit_log`.

### 4.4 Where it lives in the app

New nav item for Team Lead+: **Workflow** (or under Digest).

Sections:

1. **Practice packs** — list, edit draft, submit, approve
2. **History** — filter by pack / actor / date
3. **Usage (practice-level only)** — how often published packs were offered vs inserted; **never** per-staff scoreboards

Chairside: published packs feed **Section starters** ranking + Fast Lane featured picks (cue only; still per-block attest).

### 4.5 UX / cognitive-load controls (UIX)

- Staff builder: one closed **Section starters** chip — packs change *which* three appear, not a new permanent card
- Team Lead Workflow: one job per screen (edit ≠ approve ≠ history)
- No dashboard card grid on the note home
- Approve screen shows **diff only** + plain “what staff will see”
- Adams / plain copy for staff-facing labels; keep attestation checkboxes short

### 4.6 LLM / “bespoke model” decision

**Do not train a custom clinical LLM for packs.** Learning stays in tables (`proposals.ts` thesis). Efficiency hierarchy: deterministic ranking → optional licence-gated assist that *proposes pack or block ids* with `verifyMeaning()` → never weight updates on practice notes.

Residual risk if someone later adds generative pack drafting: high hallucination of clinical facts — refuse unless output is constrained to choosing from `SUGGESTABLE_BLOCK_IDS` only.

---

## 5. Time-savers ranked (Now / Next / Later / Never)

### Now (finish what’s nearly done)

1. Ship **Section starters** (discoverability of attested blocks).
2. **Pin MyBlocks** on builder chrome (personal QuickText).
3. Fast Lane **cue** that starters exist in History / Care delivered / Handoff.

### Next (Team Lead Workflow v1 — this research)

1. Practice packs composed from shipped blocks + modules.
2. Dual-control approve + append-only history.
3. Published packs drive Section starters order + Fast Lane featured set.
4. Practice-level pack usage rollup (no staff ranking).

### Later

1. Promote a personal MyBlock → pack candidate (PHI screen + second Lead approve; still no new audit fields).
2. Hygiene-shaped short blocks added to the **shipped** suggestable set (code + RULESET), then selectable in packs.
3. Risk-scaled sampling: Lead reviews a sample of filed notes that used packs heavily (quality coaching, not scoring).
4. Tie digest vocabulary proposals → “suggest pack change” prefill (still human ratify).

### Never

| Idea | Why |
| --- | --- |
| Staff Forms builder | Audit-blind dialects |
| Auto-fill findings / “none” / soft tissue | Invents truth |
| Silent Fast Lane pack dump | False attestation |
| Ambient Care+ clone | PHI / biometric |
| Team Lead editing another clinician’s note body | Hierarchy forbids it |
| Per-staff pack compliance scores | Notes optimized for the checker |
| Custom LLM trained on practice notes | Privacy + custody + self-consumption |

---

## 6. Chicken Little watch

| Alert | Chain | Mitigation |
| --- | --- | --- |
| Checkbox theater | Packs make click-through faster → recycled consent/complications | Keep per-block verify; measure residue failures after pack publish |
| Second Lead rubber-stamp | Self-approve bypass via buddy | Require distinct `actorId`; log rejects |
| Pack feels like a finished note | Staff skip placeholders | Residue S1; focus field after insert |
| Workflow buries chairside | New nav steals attention from note | Lead-only Workflow; builder stays one chip |
| “Approval” confused with dentist filing | Legal misunderstanding | Copy: “Pack publish ≠ dentist filing” |

---

## 7. Extension points (implementation map)

| Concern | Path |
| --- | --- |
| Capability | `src/lib/auth/roles.ts` → `canManagePracticePacks` (lead+) |
| Queue UX pattern | Wish list + store redemption (approve + note + no self) |
| Pack content | Compose `suggestedBlocks` / Fast Lane ids only |
| Schema | New `practice_packs` + `practice_pack_events` (append-only) |
| Chairside consumer | `suggestedBlocksFor` + `featuredPicksForRole` |
| Version stamp | Pack `version` on draft metadata when starters used; RULESET bump only if shipped block *text* changes |
| Audit visibility | Lead-readable pack history UI (do not wait on full `/admin/audit`) |

---

## 8. Success metrics (proposed experiment gates — not proven uplifts)

1. Time from Fast Lane tap to first attested insert ↓  
2. Section-starter open rate ↑ without residue-rule failures ↑  
3. Every published pack change has a second-person approve event  
4. Zero practice-authored freeform fields in pack diffs  

---

## 9. Decision asked of the owner

**Build Workflow v1 as composition-only practice packs (shipped blocks + modules + dual-control history)?**

- **Yes** → next engineering slice: schema + `/workflow` approve UI + wire published order into Section starters.  
- **No** → stay on discoverability (Section starters + MyBlocks pin) and keep Gauntlet as the only practice-change path.
