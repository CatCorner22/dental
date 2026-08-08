# Adversarial hate — chairside DA (documents while doctor drills)

- **Type**: red-team / adversarial stakeholder simulation (not a live interview)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, chairside, dental-assistant, gloves, focus-trap, dictation, dentist-owned, red-team
- **Status**: fix backlog ready; glove + focus + dictation conflicts are the kill criteria
- **Method**: Hostile mock agent — chairside DA with one gloved hand in the mouth / on suction, the other on a shared tablet, documenting **while the handpiece runs**. Instructed to **hate** Smile Notes. Grounded in shipped code: `.chip` / `.tap` / ToothPicker, Dialog focus trap, `DictationField` / enrollment on `/account`, dentist-owned `fieldset disabled` + `Waiting for dentist`, chip stack under every textarea, audit jump `scrollIntoView` + `focus()`. **Not** observed Cornerstone sessions — hypotheses to falsify with a real glove + drill-noise run.

## Axiom

I am not “writing a note.” I am **keeping up with a drill**. If your UI needs a clean mouse, a quiet room, both hands, or a trip to Account to set up a mic, you designed for the break room. I hate you for that.

**Why it matters:** When the DA cannot hit the chip, keep the caret, or park the dentist’s words without inventing Assessment, the record goes thin, late, or wrong — and front desk still eats the scream. This panel kills pilots that look fine in a demo and die in the operatory.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Chairside DA / RDA — documents while DDS drills; gloves wet; shared iPad on a sticky pole |
| Skill | Procedure sequencing, suction, tray, and “what the doctor just said” capture under noise |
| Core hate | Glove-miss targets · focus traps mid-sentence · dictation that fights the handpiece · dentist-owned fields that look like *my* unfinished work |

## Six hates

| # | Hate | Clinical failure | Evidence in repo | Why I hate it |
| --- | --- | --- | --- | --- |
| **1** | **Glove UX is a fine-pointer fantasy** | Wrong tooth / wrong phrase into the legal record | `.chip` = `px-2 py-0.5 text-xs` until `@media (pointer: coarse)`. ToothPicker cells `h-8 min-w-8` + `gap-1`; in-file comment admits adjacent mistap is a documentation error. Fine-pointer iPad / stylus = crumbs. | My glove is fat. Your chip is not. I do not get a second try while the handpiece is in enamel. |
| **2** | **Focus traps and focus theft** | Mid-procedure caret vanishes; I type into the void or the wrong box | `Dialog` focus trap (legal / conflict / transfer). Audit / Check-note jump: open `<details>`, `scrollIntoView`, then `focus()` the control. SuggestedBlocks insert also steals focus into the destination. Chip wrappers track focus carefully — then a jump undoes the whole point. | Doctor said “#14 MOD.” I am mid-word. Your panel jumps me to Assessment. I lose the sentence. I hate that more than a red finding. |
| **3** | **Dictation conflicts with the drill** | Garbage transcript, or no mic at all when I need hands-free | `DictationField`: mic only when enrolled + browser engine ready; otherwise “Set up dictation” → **`/account`**. Enrollment is a separate practice session. Browser ASR + handpiece scream + doctor talking over me = junk finals. Shared device keeps **someone else’s** enrollment state. | You want me to leave the chair, practice phrases, then talk into a mic that hears the turbine better than the DDS. That is not a feature. That is contempt. |
| **4** | **Dentist-owned fields as my unfinished homework** | False incomplete alarm; Transfer theater; temptation to invent diagnosis | `NoteForm`: out-of-scope sections show “— dentist records this” + **Waiting for dentist** chip + `fieldset disabled`. `tailorAuditFindings` swaps empty Assessment/Plan `required.missing` for `scope.author-handoff` (S3) — good — but locked chrome still sits in my scroll path. Filing dentist-owned content forces Transfer (`BuilderShell` / `approval`). | I document what happened. Diagnosis is not my license. Your locked Assessment still looks like a section I failed. Do not grade me on the dentist’s blank. |
| **5** | **Chip chrome under every box while I have one free finger** | Missed insert; wrong block; cognitive overload | Under each active textarea: mic / setup line, Verified blocks, Standardize, phrase chips, licence chips — comments in `inputs.tsx` already admit this was ~150px of controls × sections. Collapsed to one wrap row, still a minefield in a glove. | I need **one** big “what we did” insert, not a jewelry tray of pills under every narrative. |
| **6** | **Andon / finish path during active procedure** | Premature copy, wrong Ready confidence, or freeze while suctioning | AuditPanel findings, attestations, finish-bar gates, Transfer / Copy while the visit is still in the mouth. Status chips and blocked Submit fight for attention with the tray. | Yell “Ready” at me while the rubber dam is still on and I will soft-file garbage to make you quiet. That is how you poison Curve. |

## Five fixes (do these; stop demoing cream)

Effort = invasiveness. **Policy** = one-handed glove path must work without Account pilgrimage and without inventing dentist judgement.

| # | Fix | Kills | Notes |
| --- | --- | --- | --- |
| **1** | **Always-44 clinical targets + tooth miss-recovery** | 1, 5 | Chips, dentition tabs, phrase/block inserts, tooth cells: ≥44×44 and ≥8px gap on **all** pointers. Undo adjacent tooth. Density is not a clinical virtue. |
| **2** | **Procedure mode: caret stays put** | 2, 6 | No auto audit jump while a field is focused and has dirty text unless I press “Go to finding.” Dialogs that are not hard legal gates wait until blur / pause. Insert chips may land text **without** stealing focus if I am mid-keystroke. |
| **3** | **Chairside dictation that loses to the drill on purpose** | 3 | Push-to-talk with a fat Stop; park interim until silence; enroll from the note field without dumping me on `/account` mid-visit (deep-link + return). Off-device warning stays honest. Never auto-apply junk under handpiece noise. |
| **4** | **Honest DA lane — one strip, not locked homework** | 4 | Collapse dentist-owned sections by default for auxiliaries into a single “Waiting for dentist — Transfer when ready” strip. Keep findings / what-I-did fat and editable. Do not show Assessment required chrome as *my* open work. |
| **5** | **One glove row of inserts; hide the jewelry** | 5, 6 | Default: 1–2 large procedure inserts + mic. Verified / Standardize / licence behind a single “More” that opens on pause. Finish / Copy only after an explicit “procedure pause” or section complete — not while Andon nags mid-prep. |

## The trap — “just let the DA finish it”

**Voice-first ambient capture + unlocked Assessment for speed + soft Ready while the handpiece runs** is the trap.

It photographs as chairside empathy. Demo with a quiet conference-room mic and a dry finger. Ship it and you get: invented diagnosis under a DA login, wrong-site mistaps celebrated by a Ready chip, and a Transfer nobody does because the note already “looks done.”

Refuse: ambient invent, soft mode that teaches wrong muscle memory, and any path that lets auxiliary hands file dentist-owned judgement to keep the lobby moving. Fix the glove path and the handoff strip, or admit the product is for post-op documentation at a desk.

## Explicitly do not ship (DA hate)

- Auto-fill Assessment / Plan from what I typed in findings.
- Dictation that stays hot and inserts every drill scream as clinical prose.
- Tiny “compact” chip mode as a density win.
- Forcing Account enrollment mid-procedure with no return-to-field.
- Celebratory motion / sparkle when I finally hit the tooth after three misses.

## Bypass behaviors (what I will do to survive the chair)

| Bypass | What it looks like | Harm |
| --- | --- | --- |
| **Curve QuickText only** | Skip Smile Notes until the patient leaves | Pilot dies; thin chart returns |
| **Memory note at lunch** | Write after four patients | Wrong tooth, wrong material, wrong sequence |
| **Ask DDS to type later** | “I’ll leave it for you” | Dentist late; Transfer pile; front desk rage |
| **Tap anything green** | Fat-finger Ready / Copy to end the nag | False confidence into Curve |
| **Paper scrap then retype** | Sticky note on the tray | Double entry; lost scrap = lost fact |

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Glove / fat-stylus chip + tooth hit rate | Adjacent miss recoverable; ≥95% intended control | Silent wrong tooth / wrong phrase |
| Focus retained through 30s of continuous typing with Audit open | Caret stays; no unsolicited jump | Jump mid-word → abandon field |
| Time from “need mic” to first usable dictate without leaving note | ≤60s return-to-field path | `/account` exile mid-visit |
| Auxiliary drafts with empty Assessment showing as *writer* incomplete | Zero false unfinished on dentist fields | “2 required” culture returns |
| Same-visit paste with procedure facts, no invented diagnosis | Default | Soft-filed judgement under DA login |

## Open questions for the owner

1. **Procedure mode** — explicit toggle, or automatic while a restorative / surgical module is open and a field is focused?
2. **Dictation under noise** — push-to-talk only for chairside roles, or park-all-interim until silence for everyone?
3. **Dentist-owned chrome** — fully collapse to handoff strip for assistants, or keep read-only preview of empty Assessment?

## Related

- `knowledge/sources/adversarial-a11y-advocate-hate.md` (glove targets / ToothPicker / motion — sibling kill list; may land on a parallel branch)
- `knowledge/sources/scope-aware-templates-and-multi-edr.md` (`scope.author-handoff`, assistant featured picks)
- `knowledge/sources/voice-to-text-landscape.md` / `voice-enrollment-and-regional-english.md`
- `knowledge/sources/check-your-note-ux-research.md`
- `src/app/globals.css` (`.chip`, `.tap`)
- `src/components/builder/fields/ToothPicker.tsx`
- `src/components/builder/fields/DictationField.tsx`
- `src/components/builder/NoteForm.tsx`
- `src/lib/audit/tailorForAuthor.ts`
- `src/components/ui/Dialog.tsx`
