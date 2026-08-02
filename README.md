# Dental Note Builder

A standardized, de-identified dental-note platform for a Tennessee dental office, plus a
companion ChatGPT Skill. Every team member composes notes from the same modular templates, with
the same controlled vocabulary, in the same order — and a deterministic audit pass stops the
line before a defective or identifying draft leaves the tool.

**No patient identifier ever enters this tool or any AI platform.** Drafts are de-identified by
construction; identities, exact dates, signatures, permits, and codes are completed only in the
electronic dental record (EDR).

> **This system may form part of a legal and medical record.** It is **deterministic — it makes
> no AI calls** and stores only de-identified drafts and staff usernames. Every user acknowledges
> this once before use.

## Multi-user platform (V2)

A shared, role-based web app benchmarked on Curve Hero's UX patterns (a dashboard hub, a sticky
note header, a "Sidekick" side panel, color-coded statuses, quick-pick presets, minimal-click
charting) — patterns only, no copied material. The dashboard leads with **one-click cards** for
the four most common visit types, a **"continue where you left off"** card, clickable
**status-filter chips**, and a per-draft **"New like this"** action (same modules, empty values).
In the builder, short single-choice lists render as **one-click buttons** instead of dropdowns,
the module rail has a filter box, and clicking an audit finding jumps to **and focuses** the
field. History has a note-label column, search, and status filters.

### Roles

| Role | Can do |
|---|---|
| **Read only** | View any draft and the references; no editing or submitting |
| **User** | Create, auto-save, and submit their own drafts |
| **Admin** | Everything, plus add / deactivate / delete users, reset passwords, and transfer draft ownership |

The first admin is created at `/setup` (or from `ADMIN_USERNAME` / `ADMIN_PASSWORD`). Every API
route re-checks the caller's role server-side. The last active admin can never be locked out —
the guard runs inside a serialized transaction, so even two simultaneous demotes cannot slip
past it. A user with submission history cannot be deleted (the record must survive); deactivate
instead. Admin dialogs generate strong temporary passwords with one click (copyable, no typing).

### Draft lifecycle and status colors

Statuses are derived once (server + client share the logic) and shown as a chip that always pairs
color with an icon and a text label:

| Status | Meaning |
|---|---|
| Unfinished (slate) | Started, nothing to flag yet |
| Blocked (red) | An S0 STOP — must fix before submit |
| Action needed (orange) | An S1 REQUIRED field or placeholder |
| Review (amber) | An S2 REVIEW suggestion |
| Ready (green) | Passes the gate — ready to submit |
| Submitted (blue) | Filed with a ticket |
| Send failed (rose) | Filed, but the email did not go out |

### Auto-save and submit

Edits auto-save after ~1.5 s (version-checked; a concurrent edit elsewhere raises a reload
prompt), with an explicit **Save** button (**Ctrl+S**) and an unsaved-work guard that also covers
failed and conflicted saves. A failed save never retries in a loop — the next edit, Ctrl+S, or
Submit retries it. **Submit** (**Ctrl+Enter**) first drains every unsaved edit and refuses to
continue on a save error or conflict, so the server can never file content the user has not
seen; the server then composes the note and runs the full audit **server-side** and files it
with a ticket. Two concurrent submits of the same draft cannot double-file: an atomic claim in
the database lets exactly one through. After filing, the user chooses: **stay**, go to the
**dashboard**, or **start another like this** — a new note with the same modules and title and
**zero values copied** (structure only, never a clinical assertion).

### Tickets and traceability (anti-drift)

Every submission gets a `DN-000000` ticket and a frozen stamp: the ticket, the submitter
(display name + username), the date and time in **US Eastern** (EST/EDT resolved automatically),
the ruleset version, and the audit status. The note **and** its audit report are frozen as
immutable copies at submit time and emailed to the fixed corporate address as two attachments —
so a later change to the templates or rules never rewrites what a past note said. A single
`RULESET_VERSION` constant is stamped everywhere, and CI (`.github/workflows/ci.yml`) runs
typecheck + tests + build on every push and PR.

### Encouragement (personal only)

Each user sees their own submission count, first-pass rate, clean-note streak, a few badges, and
Sparkle the tooth mascot's (deterministic, non-AI) micro-copy — no cross-staff comparison.

### Team-spirit lines

Sparkle's lines gently encourage teamwork: clear communication, covering for each other, keeping
things simple, and putting the team first. Ground rules, enforced by a test in
`src/lib/stats/stats.test.ts`: the lines are transparent encouragement (never hidden persuasion),
fully ignorable, positive only, truthful about this workflow, and they never lecture, compare
staff, or add any tracking. They rotate once per day, appear only in the app's own screens, and
never enter a note, stamp, email, or audit report.

### Accessibility

Skip link, focus-trapped dialogs (ESC + focus return), status never conveyed by color alone,
`prefers-reduced-motion` respected, keyboard-operable pickers, and `role="alert"` on errors.

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
cp .env.example .env.local   # set AUTH_SECRET (openssl rand -base64 33)
npm test        # unit + PGlite db + full-audit tests (zero infrastructure)
npm run dev     # http://localhost:3000  → first run opens /setup
```

With no `POSTGRES_URL`, the app uses in-process PGlite under `.data/` — no database to install.
Open `/setup` to create the first admin, or set `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. Add a Postgres database (Vercel Postgres or Neon) and set `POSTGRES_URL`. Set `AUTH_SECRET`.
   The schema is applied automatically on first boot.
3. Optional — enable email export: `RESEND_API_KEY`, `EMAIL_FROM`, `CORPORATE_EMAIL`. Without
   them, submissions still file with a ticket and appear in History; they just are not emailed.
4. Optionally set `ADMIN_USERNAME` / `ADMIN_PASSWORD` to seed the first admin; otherwise use
   `/setup`. Enable Vercel Deployment Protection so only the team can reach the app, and treat the
   corporate inbox as inside the practice's HIPAA boundary.

See `.env.example` for the full list. Do **not** run without `POSTGRES_URL` in production —
PGlite's per-instance storage does not persist across serverless cold starts (the app logs a loud
warning).

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
