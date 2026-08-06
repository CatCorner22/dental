# Builder UX — Curve Hero notes, text blocks, and predictive scaffolds

- **Ingested**: 2026-08-06
- **Kind**: synthesis of public Curve Dental docs + this repo’s coded note/block system
- **Question**: What do real Curve Hero notes look like, and should Smile Notes add (or resurface) text blocks / predictive text blocks for chairside users?
- **Confidence**: Moderate for Curve product behavior (vendor docs, not a live operatory observation). High for what Smile Notes already ships (traced to code).

---

## 1. What a Curve Hero clinical note actually is

Curve does **not** primarily sell a blank SOAP textarea. Public docs describe notes as structured objects built three ways:

| Mechanism | What staff experience | Source |
| --- | --- | --- |
| **Curve Forms templates** | Drag Questions (checkboxes, dropdowns, text, yes/no, section headers) into a Template. Required fields show a red asterisk and **block save**. Colors often match appointment tags. Favorites for common visit types. | [Setting Up Note Templates](https://curvedental.zendesk.com/hc/en-us/articles/50482636787603), [Crown template walkthrough](https://curvedental.zendesk.com/hc/en-us/articles/50378848315411) |
| **QuickText** | Lighter canned-text insertion — distinct from full Forms. Curve’s own crown article tells staff to open an existing QuickText for ideas when building Forms. | Same crown article |
| **Care+ / Curve AI SOAP** | Ambient or transcript → “Curve AI SOAP Note” → draft into the notes box → **provider must review before save**. | [Curve AI SOAP Notes overview](https://curvedental.zendesk.com/hc/en-us/articles/50609579301651) |

**Behavioral traps that decide correctness** (already documented in-repo in `curve-hero-des12-blueprint.md`):

- Visit **attachment beats the tag**. A note tagged “Clinical History” from Sidekick is not visit-attached unless created from Visit / Charting History.
- Treatment Planning notes can **auto-convert** to Clinical History at checkout — recycled template language becomes the legal DOS note if nobody individualized it.
- Curve owns patient identity, DOS, provider stamp, signature, codes. Smile Notes must never hold those.

**What “a good Curve note” looks like in practice (user-felt shape):**

1. Open the **right visit** (or right-click History after checkout).
2. Pick a **favorite template** that matches the appointment type (prophy, crown, emergency…).
3. Click through **required checkboxes/dropdowns** + fill a few free-text slots.
4. Optionally insert **QuickText** for repeated sentences.
5. Save under that visit; sign / authenticate in Curve.

ADA guidance ([Templates, Smart Phrases and SOAP](https://www.ada.org/resources/practice/practice-management/templates-smart-phrases-and-soap)) still applies: templates and smart phrases are fine **only if** the entry stays patient-specific. That is exactly why Smile Notes blocks filing while `<placeholders>` remain.

---

## 2. What Smile Notes already has (often under-discovered)

The user request to “add text blocks” is partly a **discoverability** problem. The product already ships Curve-like acceleration, with stronger attestation rails:

| Feature | Path | User-felt gap |
| --- | --- | --- |
| **Verified blocks** (consent, LA, radiographs, postop, DES-12 encounter scaffolds…) | `src/lib/phrases/blocks.ts`, `BlockChips.tsx` | Chip appears only on the **focused** textarea; closed by default; labeled “Verified block” — easy to never notice in a ninety-second turnover |
| **MyBlocks** (personal saved snippets) | `/api/me/blocks`, inside BlockChips | Same: buried until the verified-block panel opens |
| **standardPhrases** per field | `src/lib/modules/*.ts` → `PhraseChips` | Good for short stems; not a visit-type “pack” |
| **Fast Lane / Quick picks** | `FastLane.tsx`, `quickPicks.ts` | Adds **modules only** — never fills clinical text (correct for safety; feels empty vs Curve Forms) |
| **Deterministic standardize + assist** | `src/lib/standardize/`, `src/lib/assist/` | Predictive *rewrite* exists behind licence gates; not “suggest the next block for this visit type” |
| **Prior notes** | `PriorNotes.tsx` | Compare only — no copy-forward (by design) |

Repo non-goal (load-bearing): **do not copy Curve Forms authoring**. Practice-authored freeform fields become dialects the audit cannot see (`knowledge/benchmarks/smile-notes-vs-curve-hero.md`). Ambient AI note generation is also a coded non-goal (`src/lib/assist/non-goals.ts`).

---

## 3. Can we add text blocks / predictive text blocks?

**Yes — and we should — inside the rails we already trust.**

### Safe (build)

1. **Contextual / predictive verified blocks**  
   Given `selectedModuleIds` + `ClinicalRole` + which section is open, rank and surface 2–4 `VERIFIED_BLOCKS` (and role-safe DES-12 scaffolds) as first-class chips **above the active section**, not only inside a focused textarea.  
   Example: restorative module → propose Local anesthetic + Consent + No complications; hygiene → Medical history + Postop (when applicable).  
   Still: nothing pre-checked; placeholders still block filing; dentist-owned diagnosis text stays role-gated.

2. **Visit-type “text packs” (structure + suggested blocks, not filled findings)**  
   Extend Fast Lane so a card does what Curve Favorites *feel* like: add modules **and** offer a one-click pack of verified blocks into the narrative / care-delivered fields — still with assertion checkboxes. This closes the “Fast Lane did nothing clinical” complaint without inventing findings.

3. **Field-level predictive stems (deterministic)**  
   Expand `standardPhrases` and optional “next phrase” suggestions from controlled vocabulary / shorthand — no model required. Hygienists and assistants live here.

4. **MyBlocks promotion**  
   Let staff pin 3 personal blocks to the home builder chrome (role-filtered). Curve QuickText analogue that stays de-identified.

### Unsafe / out of scope (do not build as “parity”)

| Tempting idea | Why it fails users or the product thesis |
| --- | --- |
| Staff-built Curve Forms clone | Audit-blind dialects; ruleset version becomes theater |
| Ambient Care+ clone | PHI / biometric; coded non-goal |
| Auto-filling diagnosis / “none” / soft tissue | Invents clinical facts; DES-12 / AI gating forbid it |
| Copy-forward prior note text | Recycles another visit’s attestation into this one |
| Predictive text that silently completes sentences with clinical claims | Same as inventing findings |

**“Predictive” here means ranking and offering attested scaffolds — not autocomplete of clinical truth.**

---

## 4. User-first success criteria (the ninety-second test)

The Artifact already admits the real failure mode: *we have not watched the ninety seconds between patients* (`knowledge/artifact/cornerstone-dental-arts.md` §6). Until that observation exists, optimize for these measurable UX outcomes:

1. **Time-to-first-useful-text** after picking a Fast Lane card drops (blocks offered without hunting).
2. **Verified-block insert rate** among filed notes rises without residue-rule failures rising.
3. Hygienist / assistant paths never surface dentist-only scaffolds as writable.
4. Copy-for-Curve flow still requires two-identifier confirmation; blocks never include DOS/patient ID.

**Highest-leverage next build (recommended order):**

1. ~~Section-scoped starters~~ — shipped as **Section starters** (Universal Core only; closed chip; hygiene-safe LA gating).  
2. Fast Lane → **cue only** (no auto-insert packs). Persona swarm rejected silent bulk insert.  
3. Pin **MyBlocks** to builder chrome (still open).  
4. Hygiene-shaped starters on Preventive / Periodontics sections (still open).  
5. Only then: licence-gated assist that *proposes* which block fits a pasted draft (still human-confirm).

**Curve-persona swarm (2026-08-06) consensus:** ship-with-tweaks → rename away from “wording,” suppress LA on prophy, one strip per viewport, focus target field after insert, never auto-fill from Fast Lane.

---

## 5. Implications for “make the note builder way better”

Curve’s unfair advantage is not prettier SOAP — it is **favorite templates + required clicks + visit attachment**. Smile Notes already beat Curve on enforcement; users feel slower because acceleration is **hidden behind focus + a closed chip**, while Fast Lane only changes structure.

Making the builder “way better” for Cornerstone staff means making the **safe blocks as obvious as Curve’s Favorites**, without becoming Forms or Care+. Predictive ranking of existing `VERIFIED_BLOCKS` / MyBlocks / phrase stems is the user-aligned path; inventing a second template authoring product is not.
