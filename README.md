# Dental Note Builder

A standardized, de-identified dental-note platform for a Tennessee dental office, plus a
companion ChatGPT Skill. Every team member composes notes from the same modular templates, with
the same controlled vocabulary, in the same order — and a deterministic audit pass stops the
line before a defective or identifying draft leaves the tool.

**No patient identifier ever enters this tool or any AI platform.** Drafts are de-identified by
construction; identities, exact dates, signatures, permits, and codes are completed only in the
electronic dental record (EDR).

## What is in this repository

| Path | What it is |
|---|---|
| `src/` | Next.js 15 web app: note builder, audit engine, email export, reference pages |
| `skill/` | Complete ChatGPT Custom GPT package (instructions + knowledge files) — see `skill/CHATGPT_SETUP.md` |
| `skill/assets/dental-note-templates.md` | The full template set: Universal Core + 27 add-on modules, the guided staff process, and the formal audit pass |
| `skill/references/` | Terminology and style, tooth/surface notation, sedation and imaging rules, Tennessee law summary, benchmark and source ledger, deployment recommendation |
| `scripts/build-lexicon.mjs` | Regenerates the spelling lexicon from the skill documents |

## The platform decision (Vercel vs. a Claude Project / Custom GPT)

The office asked which is best. The answer is **both, staged** — matching
`skill/references/deployment-recommendation.md`:

1. **ChatGPT Project / Claude Project first** (days): load `skill/` as a Custom GPT or Claude
   Project to freeze templates, terminology, audit rules, and training examples on synthetic or
   practice-approved de-identified content. Zero infrastructure.
2. **This web app second** (the multi-user tool): when several team members must submit
   standardized notes, chat instructions cannot enforce anything. This app can:
   - **One shared URL.** No per-seat AI accounts, no prompt discipline required.
   - **Poka-yoke by construction.** Dropdowns limited to controlled vocabulary; the surface
     picker physically disables occlusal on anterior teeth; required fields gate the email.
   - **Deterministic, identical output** for every user — standard work, not generative variation.
   - **No AI in the loop.** The primary workflow never sends a word to any AI platform, which
     makes the "no PII into AI" rule structural instead of behavioral.
   - **Email export** needs a server; chat tools cannot attach files to corporate email.

## Toyota Production System mapping

| TPS idea | Where it lives here |
|---|---|
| Standard work | One Universal Core + modular add-ons compose in one canonical order for every user |
| Poka-yoke (error-proofing) | Controlled dropdowns, tooth/surface pickers that disable invalid anatomy, recipient-less email API |
| Jidoka (stop the line) | S0 STOP findings block export; S0/S1 block email; the server re-audits so a tampered client cannot bypass the gate |
| Andon (visible signal) | Live audit panel with S0–S4 severity chips and overall status, always visible while typing |
| Kaizen | Terminology lives in one data file (`src/lib/vocab/`); the reference page and the audit both read it, so improvement happens in one place |

## The audit pass

Severities follow the formal audit model in the template set: **S0 STOP** (possible identifiers,
wrong-site anatomy), **S1 REQUIRED** (missing required facts, unresolved placeholders, TBD/TODO),
**S2 REVIEW** (vague phrases, fact-hiding shorthand, stale copy-forward text, medication-name
typos, mixed dentition), **S3 STYLE** (deterministic wording fixes such as X-ray → radiograph),
**S4 INFO** (unknown-word spelling notes). Overall status is BLOCKED → NEEDS CLINICIAN ACTION →
READY FOR CLINICIAN REVIEW → AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED. The audit never
returns a percentage, never auto-fixes clinical text, and never replaces clinician review. An
exportable audit report follows the standard format from the template set.

Checks include: PHI heuristics (SSN, phone, exact dates, email, record numbers, honorific +
name); ADA Universal tooth validation across permanent (1–32), primary (A–T), and supernumerary
(51–82, AS–TS) dentitions; surface-anatomy validation (I vs. O, B vs. F); FDI-notation leakage;
banned abbreviations and vague phrases from the terminology standard; misspelling detection with
a dental lexicon and medication-name protection; duplicate-sentence and stale-text signals.

## Safety boundaries (enforced in code and tests)

- Never computes, converts, or suggests a drug dose; measurement bounds are typo sanity only.
- Never auto-applies a suggestion; a person makes every edit.
- No clinical-assertion defaults — nothing is pre-checked or pre-filled.
- No CDT/SNODENT codes; plain-language procedure names only. Codes live in the EDR.
- Stateless: no database, no localStorage, nothing persisted server-side; note text is never
  logged. Email goes only to the fixed corporate address; requests containing any recipient
  field are rejected.
- PHI heuristics are an aid, not a certification — the practice's HIPAA process governs.

## Run it

```bash
npm install
npm test        # 63 tests: vocab, schema, composer, audit rules, gating, email validation, e2e
npm run dev     # http://localhost:3000
```

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel (defaults work; no config needed).
2. Optional — enable the email export in Project Settings → Environment Variables:
   - `RESEND_API_KEY` — from [resend.com](https://resend.com) after verifying your sending domain
   - `EMAIL_FROM` — verified sender, e.g. `notes@yourpractice.com`
   - `CORPORATE_EMAIL` — the one fixed recipient inbox
   - `ACCESS_CODE` — optional shared code required to send
   Without these, the app runs download-only and says so.
3. Restrict access (recommended): enable Vercel Deployment Protection so only the team can open
   the app, and treat the corporate inbox as inside the practice's HIPAA boundary.

## Keep it current

- Templates/terminology change → edit `skill/` markdown and `src/lib/vocab/`, run
  `node scripts/build-lexicon.mjs`, run `npm test` (the dogfooding test fails if the app's own
  phrases break the standard), commit.
- Re-check the [Tennessee SOS Rule 0460 index](https://publications.tnsosfiles.com/rules/0460/0460.htm)
  and Board notices before relying on the law summary; it is an internal training aid, not legal
  advice.

## Disclaimers

This tool standardizes documentation wording and order. It does not provide clinical, legal,
coding, or billing advice; does not certify HIPAA de-identification or regulatory compliance;
and does not replace the licensed clinician, who must compare every fact with the source record,
resolve every finding, and sign in the EDR.
