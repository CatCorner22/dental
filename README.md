# Smile Notes

A standardized, de-identified dental-note platform for a Tennessee dental office. Every team
member composes notes from the same modular templates, with the same controlled vocabulary, in
the same order — and a deterministic audit pass stops the line before a defective or
identifying draft leaves the tool. The web app is the only runtime: the previous companion
ChatGPT Skill is retired (see `skill/CHATGPT_SETUP.md`).

**No patient identifier ever enters this tool or any AI platform.** Drafts are de-identified by
construction; identities, exact dates, signatures, permits, and codes are completed only in the
electronic dental record (EDR).

> **This system may form part of a legal and medical record.** The core is **deterministic** and
> stores only de-identified drafts and staff usernames. An **optional, opt-in AI assist** exists
> (`ASSIST_ENABLED=1`): it runs server-side only, is blocked by the same PHI gate that guards
> export, and every AI draft is refused by a deterministic verifier if it differs from the input
> in clinical substance — changed numbers, negations, drugs, teeth, or attributions. With AI
> disabled (the default), the app makes no AI calls at all. Every user acknowledges the
> legal-record notice once before use.

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

Five roles. Rank governs general access; **user management is governed by a separate capability
table keyed on the _target's_ role**, which is how "top of the practice, but may only ever add
Team Leads" is expressed without collapsing into "can do everything below me". Every rule is a
named predicate in `src/lib/auth/roles.ts`, and every cell below is asserted by a test.

| Capability | Read only | Team Member | Team Lead | Hierarchy Manager | SN Developer |
|---|:-:|:-:|:-:|:-:|:-:|
| Write / submit own Smile Note | – | ✅ | ✅ | ✅ | ✅ |
| See all practice notes & history | ✅ | own only | ✅ | ✅ | ✅ |
| Transfer a note to another person | – | – | ✅ | ✅ | ✅ |
| Add users | – | – | ✅ *(Read only / Team Member)* | ✅ *(Team Lead only)* | ✅ *(any)* |
| Merge users | – | – | ✅ *(≤ Team Member)* | ✅ *(≤ Team Lead)* | ✅ *(any)* |
| Send a password-reset **link** | – | – | ✅ *(≤ Team Member)* | ✅ *(≤ Team Lead)* | ✅ *(any)* |
| See or set a password directly | – | – | **never** | **never** | ✅ |
| Edit the email on an existing account | – | – | – | ✅ *(≤ Team Lead)* | ✅ |
| Change a user's role | – | – | – | ✅ *(to Team Lead)* | ✅ *(any)* |
| Delete a user | – | – | – | ✅ *(≤ Team Lead)* | ✅ |
| Submit a Data Hygiene Gauntlet ticket | – | – | ✅ | ✅ | ✅ |
| Read the audit log | – | – | – | ✅ | ✅ |

Two things a deploying practice should know before handing out roles:

- **"Read only" is a practice-wide view of every clinical note.** It is the lowest rank but not
  the narrowest read — a Team Member sees only their own notes, a read-only account sees
  everyone's. That is deliberate (the role exists for a biller, a locum, or a reviewer, and
  scoped to "own notes" it would see nothing at all), but it means a read-only account must be
  issued as carefully as a privileged one.
- **Two rules enforce separation of duties**, because either half alone is an account takeover:
  whoever changed an account's email may not also send its reset link, and nobody may transfer or
  merge work into an account they created themselves. In both cases a colleague or a Smile Notes
  Developer can do it, so there is always a way forward — it just takes two people.

Hierarchy Managers must have two different email addresses on file, one of them a management
group address, so the practice's escalation path is never a single unread mailbox.

Accounts can enable **TOTP two-factor authentication** (any authenticator app) from
`/account`: a live code is required at sign-in, checked only after the password verifies and at
the same throttle cost, so the second factor never becomes a free oracle. A lost device is
reset by a Smile Notes Developer as a named, logged event.

The first developer account is created at `/setup` (or from `ADMIN_USERNAME` / `ADMIN_PASSWORD`).
The `admin` value is kept in the database for backward compatibility; its label is
"Smile Notes Developer". Both the
API routes **and the pages** re-read the caller's role and active state fresh from the database
on every request, so demoting or deactivating a user takes effect on their very next click, not
when their token expires. The legal-record notice is enforced server-side: until a user
acknowledges it, every API refuses to act (except the acknowledgment itself). The last active
admin can never be locked out — the guard runs inside a serialized transaction, so even two
simultaneous demotes cannot slip past it, and first-time setup is atomic against a concurrent
double-bootstrap. A user with submission history cannot be deleted (the record must survive);
deactivate instead. Admin dialogs generate strong temporary passwords with one click (copyable,
no typing). Usernames are stored lowercase, and login burns constant bcrypt time whether or not
the username exists.

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

### Encouragement, progression, and the store (privacy stated exactly)

The dashboard is for starting and resuming notes — not a scoreboard. First-pass rates, clean
streaks, ranks, XP, GPA trends, and badge strips stay off the logged-in hub so hallway comparison
cannot start from the home screen. Sparkle the tooth mascot still offers deterministic, non-AI
micro-copy (greeting and post-file only). Every filed note still carries a frozen **GPA**
(Completeness / Specificity / Consistency / billing-narrative Justification) derived from the
audit report — never a second filing gate — and points may still accrue for the optional
**clinic store** (`/store`, practice-fulfilled, lead-approved) and **training arena**
(`/training`). Neither is promoted in the primary nav next to charting.

**Peers never see each other's numbers.** A Team Lead's dashboard (`/admin/team`) shows
practice-wide ops aggregates (time-to-file, after-hours volume, narrative completeness) and store
fulfillment — never named coaching bands, never per-note scores, never a ranked list. Coaching
stays a conversation, not a dashboard label.

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
| `src/` | Next.js 15 web app: note builder, standardizer with resolution queue, audit engine, AI assist, email export, reference pages |
| `skill/` | **Retired** ChatGPT Custom GPT package, kept as historical reference — the reference pages and vocab tables in `src/` are the single terminology truth |
| `skill/assets/dental-note-templates.md` | The original template set (Universal Core + add-on modules; the live registry in `src/lib/modules/` now has 31 add-ons), the guided staff process, and the formal audit pass |
| `knowledge/` | Research digests: Curve Hero benchmark, TN law, industry standards and medication safety, litigation patterns |
| `public/brand/` | Original Smile Notes logomark and lockup (see `docs/brand.md`) |
| `scripts/build-lexicon.mjs` | Regenerates the spelling lexicon from the skill documents |

## The platform decision

**The web app is the only runtime.** The staged plan (ChatGPT project first, web app second)
served its purpose during template development and is retired: chat instructions cannot enforce
anything, and every capability the skill provided now exists in the app with enforcement —
plus AI assist that is actually safe to use on clinical text:

- **One shared URL.** No per-seat AI accounts, no prompt discipline required.
- **Poka-yoke by construction.** Dropdowns limited to controlled vocabulary; the surface
  picker physically disables occlusal on anterior teeth; required fields gate the email;
  verified blocks carry placeholders the audit blocks until they are replaced.
- **Deterministic, identical output** for every user — standard work, not generative variation.
- **AI with rails, not vibes.** The optional assist layer (tighten wording, structure as SOAP,
  completeness interrogation, contradiction check) runs server-side after the PHI gate, and a
  deterministic verifier refuses any AI draft that changes clinical substance. A chat tool can
  promise that; this app enforces it.
- **Email export** needs a server; chat tools cannot attach files to corporate email.

## Toyota Production System mapping

| TPS idea | Where it lives here |
|---|---|
| Standard work | One Universal Core + modular add-ons compose in one canonical order for every user; verified blocks are the standard wording for the fact patterns audits ask about |
| Poka-yoke (error-proofing) | Controlled dropdowns, tooth/surface pickers that disable invalid anatomy, recipient-less email API, verified blocks whose placeholders block filing until replaced with this visit's facts |
| Jidoka (stop the line) | Any S0 STOP blocks export (copy/download) and email; S1 additionally blocks email; the standardizer's fix-or-attest queue locks Copy until every concern is fixed, attested with a named reason, or escalated to a Team Lead; submission files atomically; the server re-audits so a tampered client cannot bypass the gate |
| Andon (visible signal) | Live audit panel with S0–S4 severity chips; the standardizer's red/amber/green queue strip with progress count |
| Kaizen | Terminology lives in one data file (`src/lib/vocab/`); rule disagreements escalate as named, reasoned entries and surface as drift stats to the people who can tune the rule — the tool's own error signal, human-reviewed, never self-adjusting |
| Respect for people | No override theater: the tool never auto-corrects, attestations put the author's judgment on the record, and a genuine disagreement gets a decision from a human with authority, not a dead end |

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
a dental lexicon and medication-name protection; duplicate-sentence and stale-text signals;
**medication-safety gates** (pounds-beside-mg/kg, dose arithmetic that cannot reconcile,
household spoon units, mixed unit systems, and a curated dental drug-interaction screen —
flag-only, never a computed or suggested dose); **effort gates** (keyboard-mash filler and
wording that characterizes the patient instead of documenting the visit); and **anticipatory
completeness** (images with no interpretation, anesthetic with no amount, extractions with no
outcome, prescriptions with no duration, consent discussions with no decision — the questions a
later reader will ask).

## Safety boundaries (enforced in code and tests)

- Never computes, converts, or suggests a drug dose; measurement bounds are typo sanity only.
- Never auto-applies a suggestion; a person makes every edit.
- No clinical-assertion defaults — nothing is pre-checked or pre-filled.
- No CDT/SNODENT codes; plain-language procedure names only. Codes live in the EDR.
- **What is persisted, stated exactly** (this changed in V2 and the line above used to say
  "stateless", which was true only of V1): drafts, filed submissions, user accounts, password-reset
  token hashes, and an audit log live in Postgres. Note **text** is never written to a log or to
  stderr, and the tool holds no patient identifiers by design — the de-identification rule is what
  keeps the stored content safe, not an absence of storage. A filed note and its audit report are
  frozen copies that are never rewritten.
- Email goes only to the fixed corporate address; requests containing any recipient field are
  rejected.
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
   Optional — enable AI assist: `ASSIST_ENABLED=1` + `AI_GATEWAY_API_KEY` (and optionally
   `ASSIST_MODEL`). Calls run server-side after the PHI gate; every output is verified against
   the input before a human sees it. Confirm the provider/gateway configuration fits the
   practice's HIPAA posture — input is de-identified by construction, but that diligence is the
   practice's, not the tool's.
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

## Copyright and privacy

© Copyright 2026 Blake Reagan, all rights reserved.

Privacy Policy: by using this software platform, you agree that you will not input PII or other
legally sensitive information into Smile Notes.

The same notice is rendered in the footer of every page and on the sign-in screen — see
`src/lib/brand.ts`, which is the single source for the product name and both legal lines.
