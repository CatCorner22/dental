# Adversarial hate panel — after-hours emergency dentist

- **Type**: red-team / adversarial stakeholder simulation (not a live interview)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, emergency, after-hours, trauma-speed, fast-lane, check-your-note, modules, red-team
- **Status**: fix backlog ready; trauma-path finish policy needs owner lock
- **Method**: One hostile mock agent — dentist covering after-hours / same-day emergency (swollen face, pain visit, drainage / palliative care). Instructed to **hate** Smile Notes for **module shopping**, **Check-your-note essays**, and any **slow path while the patient is swollen**. Grounded in shipped surfaces (`emergency` Fast Lane pick, `emergency` / `imaging` / `medication` modules, Fast Lane “modules only,” pack-starter Yes/Not now, `CheckNoteSummaryPanel`). **Not** observed Cornerstone after-hours sessions — hypotheses to falsify on a real swollen-face walk-in.

## Axiom

I am not writing a novel. I am writing a **legal note while a face is swollen**, often alone after hours, with Curve still empty. If Smile Notes makes me **shop modules**, then **read an essay** before Copy, the product is slower than the infection. I will abandon you for Curve QuickText and you will call it “low adoption.”

**Why it matters:** Daytime elective UX can afford GOV.UK check-answers theater. After-hours emergency cannot. The same finish summary that protects a crown visit becomes **schedule poison and care delay** when airway screen and drainage compete with chips.

## Persona

| Field | Value |
| --- | --- |
| Role | After-hours / same-day emergency dentist (GP covering call; swollen face, pain, trauma, palliative) |
| Skill | Triage → stabilize → chart bare-minimum reconstructible facts → paste → go home |
| Personality | Hostile to catalog UX; zero patience for second dialogs; clocks the patient, not your Ready chip |
| Core hate | Module shopping · Check-your-note essays · slow path while patient is swollen |

## 5 hates

### 1. Module shopping under a swollen clock

Fast Lane “Emergency / pain visit” adds `emergency` + `imaging` + `medication` — then **vanishes** (`visible` only while Core-only). Need extraction, endo pulp relief, or operative drainage? Open the **Modules** dialog, search the catalog, checkbox-hunt. BuilderShell itself admits the picker used to burn a 240px column and is now “a click on the rare visit that needs it.” After hours, the multi-module emergency **is** the visit. Shopping is not rare. It is the product insult.

### 2. Fast Lane that only scaffolds emptiness

Title says Fast Lane. Tooltip truth: **“adds modules only. Nothing clinical is filled in.”** Correct for safety. Feels like a cruel joke when the face is swollen: three empty add-ons, required fields still blank, then an optional pack-starter panel asking **Yes — show starters** / **Not now** before any attested block appears. I tapped Emergency. You gave me homework folders. Curve Favorites at least dump text I can edit.

### 3. Check-your-note essays at the finish gate

`CheckNoteSummaryPanel` opens with a paragraph (“Before this leaves Smile Notes — modules, litigation-sensitive gaps, and open stops…”), lists **Modules:** titles, killer rows with suggestions, up to five open stops, an **omission-licence lecture**, and a litigation-sensitive **ack checkbox**. GOV.UK check-answers is right for form confirmation. At 21:40 with cellulitis risk, it reads as a **compliance essay** between me and the clipboard. Killer hoist was the point. The prose and the full stop parade are the tax.

### 4. Daytime module density on a trauma visit

Emergency add-on alone asks chief problem, ABC/swelling screen, site-spread, pain, tests, images, diagnosis, care, stabilization, medication, escalation, follow-up — then Imaging and Medication add-ons duplicate lanes (“See the Imaging add-on.” / “See the Medication…”). Universal Core still sits underneath. I am not hostile to completeness. I am hostile to **twelve empty boxes** when four facts move care: site, working diagnosis, what I did, return precautions / escalation. Your structure assumes elective pace.

### 5. After-hours alone = every tax stacks

No Lead for Transfer theater. Shared iPad may hold someone else’s draft. Paste + two-ID handoff still required (charter — fine). Wifi hiccup + audit panel + pack Yes/Not now + Check-your-note ack = **I chart in Curve and you lose the night.** Front-desk hate already said schedule slip kills pilots. After hours there is no front desk to absorb the scream — only the dentist who stops using you.

## 4 trauma-speed fixes

Effort = invasiveness. **Policy lock:** trauma path stays reconstructible (findings / care / escalation / anesthetic amount when used). Speed = fewer hops and less essay, not soft gates.

| # | Fix | Attacks hates | Notes |
| --- | --- | --- | --- |
| **1** | **One-motion Emergency path** — Fast Lane `emergency` stays; after apply, **auto-surface** ranked section starters / pack blocks for Emergency + Imaging + Medication (still per-block attest). Skip the Yes/Not now ask on this pick only, or default Yes with one dismiss. Extend Fast Lane visibility until emergency modules have first text — do not hide the lane the moment structure lands. | 1, 2, 5 | Reuse `FastLanePackOffer` / `suggestedBlocks`; no silent dump of clinical facts. Optional: second pick “Emergency + extraction” without catalog shopping. |
| **2** | **Swollen-face finish: killer strip, not essay** — On notes with urgency `emergency` / `urgent` or `emergency` module active, Check-your-note collapses to **≤3 killer rows + fat Copy**. Drop the intro paragraph, module title parade, omission lecture, and non-killer stop list from the dialog (stops still block via existing gates / Sidekick). Keep Change links. Keep killer ack only when a killer is open. | 3, 4, 5 | Aligns with front-desk “DDS killer-only finish.” Daytime elective keeps full summary. |
| **3** | **Emergency field triage (UI order, not new invention)** — For `emergency` module: surface **chief problem → screen (ABC/swelling) → site-spread → diagnosis → care → escalation** first; collapse or demote duplicate image/med pointers when Imaging / Medication add-ons are already selected. Prefer one medication lane, one imaging-interpretation lane. | 4, 1 | Presentation / required-path UX. Do not invent findings. Keep required clinical slots that litigation actually needs. |
| **4** | **After-hours solo preset** — Role or visit flag: hide Workflow / module-catalog chrome by default; pin Emergency Fast Lane + My blocks; fat Copy; no Transfer CTA. Draft survivability already researched — make it the default assumption for call coverage. | 5, 1 | Ops + UI. Shared-device author switch still mandatory (wrong author is still a kill). |

### Sequencing this dentist will accept

1. Ship **#1 + #2** or nights stay on Curve QuickText.
2. Ship **#3** or empty-box density still feels like elective paperwork.
3. Ship **#4** or shared-iPad after-hours keeps killing the path.

## Trap

**Do not ship “emergency soft mode.”**

The persona will beg for: skip Check-your-note, skip killers, skip anesthetic amount, skip imaging interpretation, “just let me Copy — the face is swollen.” That is the trap.

Soft / training mode that graduates thin emergency notes (“I&D done, Rx given”) recreates the MedPro sparse chart on the exact visit class carriers already punish. Silent Fast Lane clinical fill / ambient Care+ prose that invents ABC findings, airway negatives, or drainage detail the dentist never stated is the same trap with a prettier face — worse after hours, because nobody double-checks before paste.

Refuse: soft gates for urgency; silent pack dump; AI-authored emergency narrative that outruns `verifyMeaning()`; treating Ready chip as permission to skip two-ID paste.

Speed fix = **fewer empty hops and less finish essay**. Speed fix ≠ **weaker truth**.

## Grounding (code / surfaces already in repo)

| Surface | Location | Emergency read |
| --- | --- | --- |
| Fast Lane Emergency pick | `src/lib/presets/quickPicks.ts` (`emergency` → emergency/imaging/medication) | Right intent; structure only |
| Fast Lane hide-after-apply | `FastLane.tsx` `visible` Core-only | Lane disappears when shopping still needed |
| Pack starters ask | `FastLanePackOffer.tsx` Yes / Not now | Extra dialog before text |
| Emergency module density | `src/lib/modules/emergency.ts` | Full trauma form; duplicates imaging/med pointers |
| Module catalog dialog | `BuilderShell.tsx` `showModules` | Explicit shopping hop |
| Check-your-note essay | `CheckNoteSummary.tsx` | Intro + modules + killers + stops + omission + ack |
| Killer set | `src/lib/audit/killers.ts` | Keep on trauma path — hoist compact, do not delete |

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Median tap Emergency → first attested clinical sentence | Down sharply vs catalog+empty modules | Flat → Curve bypass |
| Median ready→clipboard on urgency=emergency / emergency module | ≤ elective baseline; essay path not longer | Persistently slower → night abandonment |
| Emergency Copy with open anesthetic-amount or imaging-interpretation killer (when those acts occurred) | → 0 | Soft-mode leak |
| After-hours notes filed Curve-only despite Smile Notes login | Falling | Rising → product failed the swollen clock |
| Module-dialog opens per emergency note | Near zero after fix #1 | Still shopping → path not one-motion |

## Open questions for the owner

1. **Trauma finish:** killer-strip only when `emergency` module is on, when urgency select is emergency/urgent, or both?
2. **Pack starters on Emergency Fast Lane:** skip Yes/Not now (show attested list immediately), or keep one dismissible ask?
3. **Emergency + extraction** as a second Fast Lane card — accept two cards to kill catalog shopping?

## Related

- `knowledge/sources/adversarial-hate-front-desk.md` (schedule slip / DDS killer-only finish — daytime twin)
- `knowledge/sources/check-your-note-ux-research.md` (killer hoist; guardrail on ready→clipboard time)
- `knowledge/sources/builder-text-blocks-predictive-ux.md` (Fast Lane emptiness vs Curve Favorites)
- `knowledge/sources/team-lead-practice-packs-workflow.md` (no silent Fast Lane dump)
- `knowledge/sources/litigation-documentation-research.md` (sparse operative / incomplete detail)
- Charter: paste + two-ID handoff; no Curve write-back; no invented clinical facts
