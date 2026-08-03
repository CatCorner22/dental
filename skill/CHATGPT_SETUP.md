# Set up the ChatGPT Skill (Custom GPT)

> **RETIRED (2026-08-03).** The practice no longer uses ChatGPT for note work — the Smile
> Notes web app is the only runtime. Everything this skill did now exists in the app with
> actual enforcement: the standardizer with its fix-or-attest queue, the deterministic
> audit, verified blocks, and the verifier-gated AI assist (`ASSIST_ENABLED=1`). **Do not
> load this package into a Custom GPT for daily work** — its terminology tables are no
> longer maintained and have already drifted from the app's vocab (the app's
> `/reference` pages and `src/lib/vocab/` are the single source of truth). This folder is
> kept as historical reference and as source material for `scripts/build-lexicon.mjs`.

This folder is a complete, portable "Skill" package. It standardizes and harmonizes dental-note
words and phrases so staff drafts come out consistent. It works in ChatGPT (Custom GPT), and the
same files work in a Claude Project.

## What is in this folder

| File | Role |
|---|---|
| `SKILL.md` | The instruction set. Paste it into the GPT's Instructions box. |
| `assets/dental-note-templates.md` | The full de-identified template set (Universal Core + all add-ons). Upload as Knowledge. |
| `references/terminology-and-style.md` | Controlled terminology, banned abbreviations, vague-phrase replacements. Upload as Knowledge. |
| `references/tooth-and-surface-notation.md` | Universal tooth numbering and surface codes. Upload as Knowledge. |
| `references/sedation-and-imaging.md` | Sedation, anesthesia, and imaging documentation rules. Upload as Knowledge. |
| `references/tennessee-dental-law-summary.md` | Tennessee law and Rule 0460 issue-spotter. Upload as Knowledge. |
| `references/source-ledger.md` | Template benchmark summary and evidence ledger for every rule in the Skill. Upload as Knowledge. |
| `references/deployment-recommendation.md` | Rollout guidance: ChatGPT Project first, Vercel app second, with required controls. Upload as Knowledge. |

## Create the Custom GPT

1. In ChatGPT, open **Explore GPTs → Create** (requires a ChatGPT plan that includes GPTs).
2. **Name:** `Standardize Dental Notes`.
3. **Description:** `Drafts, normalizes, and audits de-identified U.S. dental notes. Never enter patient identifiers.`
4. **Instructions:** paste the full text of `SKILL.md`.
5. **Knowledge:** upload all seven files from `assets/` and `references/`.
6. **Capabilities:** turn OFF web browsing, image generation, and code interpreter. The Skill
   needs none of them, and fewer capabilities means fewer ways to leak data.
7. **Conversation starters** (suggested):
   - `Give me a blank note template for a surgical extraction with IV moderate sedation.`
   - `Normalize this de-identified draft to the office standard.`
   - `Check these tooth and surface entries for errors.`
   - `What does Tennessee Rule 0460 require in a sedation record?`
8. Share the GPT with your workspace ("Anyone at [workspace]"), not publicly.

## Team rules (post these where staff will see them)

- Never enter a patient name, exact date, contact detail, record number, or image.
- Use placeholders like `<tooth>`, `<date of service>`; complete them only in the EDR.
- The Skill drafts and flags. A licensed clinician reviews, resolves every flag, and signs in
  the EDR. The Skill never diagnoses, selects treatment, or calculates a dose.

## Claude Project alternative

Create a Claude Project, paste `SKILL.md` into the project instructions, and add the seven
knowledge files to the project. Behavior is equivalent.

## Rollout order

`references/deployment-recommendation.md` sets the staged rollout: use a private ChatGPT
Project first to freeze templates, terminology, audit rules, and training examples on
synthetic or practice-approved de-identified content; move the team to the web app when you
need hard required-field gates, dropdowns, the deterministic audit, and the corporate-email
export. The web app in this repository implements that second stage without sending any note
text to an AI platform.

## Keep it current

When the office updates the web app's terminology (`src/lib/vocab/`), regenerate or re-edit
`references/terminology-and-style.md` to match, and re-upload it to the GPT. The web app's
`/reference/abbreviations` page always shows the live list the audit uses.
