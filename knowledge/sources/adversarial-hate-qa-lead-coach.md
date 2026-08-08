# Adversarial hate — Team Lead / QA coach (notes)

- **Type**: red-team / adversarial stakeholder simulation (single lens, first person)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, team-lead, coaching, digest, attestation, s2, practice-packs, scoreboard, red-team
- **Status**: Lead-tool fix backlog; trap = scoreboards (do not “help” by ranking people)
- **Method**: Hostile mock Team Lead instructed to **hate** Smile Notes as a coaching instrument that pretends to help and then leaves the coach blind. Personality: mid-career Lead who coaches notes, not HR. Grounded in shipped code: `/digest` (no open/ack), soft S2 + non-blocking killers, anyone-can-attest (reason codes without Lead rollup), practice packs without usage metrics, GPA that is never a coaching queue. **Not** observed Cornerstone Lead interviews — hypotheses to falsify with a real coaching week.

## Axiom

I coach notes so the chart survives a bad week. Your “Documentation digest” is a **wall of unread prose**, your packs have **no offered-vs-inserted truth**, your S2 says “worth a look” while filing sails through, and staff **attest everything** so the Andon goes green. That is not quality. That is **theater with a Lead login**.

**Why it matters:** Pilots die two ways — hygiene walks when you scoreboard them, and Leads stop opening the tool when coaching has no lever. Soft S2 + blank pack metrics + attest spam train the shortest gate-clearing note. Fix the **Lead tools**, or admit the digest is a museum exhibit.

## Persona (hate lens)

| Field | Value |
| --- | --- |
| Role | Team Lead / QA coach — owns documentation huddles, packs, escalations |
| Skill | Pattern spotting across filed notes; hates performance theater |
| Frame | Coaching instrument, not surveillance cosplay and not a scoreboard |
| Trust baseline | Low. Every pretty panel that cannot start a 90-second coach card is waste |
| Success for *them* | Staff fix the thin pattern this week without being ranked like sales |
| Success for *you* | Lead opens digest weekly and ships one pack/vocab change — without ranking people |

---

## Six hates

### 1. Unread digest — a monthly essay nobody owes me an open on

`/digest` dumps 30 days of signals, vocab proposals, grammar growth, ByteStar counts. There is **no last-opened**, no ack, no “acted,” no 90-second coach card. I am supposed to care. The product does not care whether I opened it. An unread digest is **homework for a ghost**. If opening it changes nothing in Workflow, packs, or tomorrow’s huddle, stop calling it a coaching surface.

### 2. No pack usage metrics — I publish into the void

Practice packs Workflow exists. Dual control. History. Chairside offer after Fast Lane. Beautiful. Then: **zero practice-level offered vs inserted vs residue-fail rollup**. I cannot tell which pack is theater and which pack saves thumbs. Your own research promised “Usage (practice-level only) — never per-staff scoreboards.” Ship the metric or stop making me approve packs I cannot falsify. Blind curation is vanity.

### 3. Soft S2 — “worth a look” is permission to ignore

`SEVERITY_MEANING.S2`: does not block. `computeGates` blocks export on S0 and email on S0+S1. Completeness killers stay **S2** on purpose. Anesthetic exceedance stays **S2** on purpose. Fine for filing honesty. Hostile for coaching: the thin consent line, the missing rationale, the dose that “asks,” all file with a shrug. Check-your-note can hoist killers in the UI — the Lead still inherits a period full of **filed S2 litter with no forced pattern**. Soft S2 without a Lead pattern view is how sparse charts become “READY FOR CLINICIAN REVIEW” folklore.

### 4. Staff who attest everything — green rows, empty charts

`AuditPanel`: almost anything not S0 / `required.missing` is attestable. Reason codes exist (`correct-as-written`, patient-quote, practice-standard-term…). Anyone with a login can swear the flag away. Escalation is optional. There is **no attestation-authority tier** (assistant vs clinician vs second person on killers/PHI — already named in high-stakes patterns research). Result: chronic attesters clear the panel with four words and a code. I coach ghosts. The deposition gets a warm checkbox; the patient gets a thin note.

### 5. Reason codes without a coaching rollup — you collected the data and buried it

You made attestations aggregable. Digests do not aggregate them. Filing rollup research exists; Lead still cannot open a period view of **attest category counts at practice level** (how often `correct-as-written` vs real patient-quote; killer ack vs fix). Codes without rollup are **compliance cosplay**. I need categories to coach templates and packs — not a named hall of shame.

### 6. Signals without a queue — person rows that cannot become a private coach act

Digest person-scope signals name people (Lead+ only — good). Then what? No private “sample three notes / one huddle prompt / one pack pin” action that stays off the floor. Escalated rule-disagreement wishes sit elsewhere. GPA is frozen and **never a gate** (correct) and also **never a coaching queue** (useless to me). I get pattern poetry. I do not get a next step that is not a performance review.

---

## Five Lead-tool fixes (do these; do not build a scoreboard)

Effort = invasiveness. Policy lock: **practice-level metrics and private Lead coaching only — never peer ranks.**

| # | Fix | Kills | Notes |
| --- | --- | --- | --- |
| **L1** | **Digest open/ack + 90-second practice coach card** | 1, 6 | Stamp Lead last-opened. Card = ≤3 practice-level actions (vocab proposal, pack change, template residue). Person signals stay Lead-confidential; never huddle theater. Unread = red for *me*, not for staff. |
| **L2** | **Practice pack usage: offered / inserted / residue-fail** | 2 | Period rollup by pack id + version. No author ranks. Falsify dead packs; retire or rewrite. Matches packs Workflow “Next” research. |
| **L3** | **S2 pattern strip for killers + dose exceedance** | 3 | Period counts of filed notes that left completeness killers / dose S2 open (not a per-person leaderboard). Ties Check-your-note hoist to coaching evidence. Soft gate stays; blind Lead does not. |
| **L4** | **Attest authority tiers + practice attest-code rollup** | 4, 5 | Bind who may attest which severity/killer class. Digest: practice counts by reason code. Flag *patterns* of `correct-as-written` spam as a template/tool problem first — person coaching only when sample size and Lead judgment warrant, still private. |
| **L5** | **Private coaching queue from escalations + sparse sample** | 6 | Queue = escalated wishes + optional risk-scaled sample of filed notes (pack-heavy / killer-heavy). One next action per item. Never GPA rank. Never public Andon wall. |

---

## The trap — scoreboards

**“Help the Lead” by ranking people** is the trap.

Peer GPA boards. “Top attester.” Density leaderboards on home. Public Andon walls. Named screenshots in the Monday huddle. “Engagement” stars for clean notes.

It photographs as accountability. It is how quality tools become **performance management**, how staff write the shortest note that clears gates, and how hygiene quietly returns to Curve QuickText. Your own digest header already confesses this:

> a running tally is how a quality tool becomes a performance-management tool, and staff who believe they are being scored write the shortest note that clears the gates — which is the exact outcome this product exists to prevent.

The RDH hate panel will walk out on **X1** (peer scoreboards). This Lead hate panel walks out on the **mirror sin**: a Lead dashboard that cannot coach without ranking. Ship L1–L5 as **instruments**. If your “fix” is a scoreboard, you did not fix Soft S2 or attest spam — you weaponized them.

## Explicitly do not ship (Lead hate + charter)

- Peer scoreboards / ranked GPA / “top writer” digests
- Public Andon shame walls
- Per-staff pack compliance scores
- Soft training mode that disables hard stops so coaches feel “progress”
- Lead editing another clinician’s note body
- Silent Fast Lane pack dump (false attestation at scale)
- Ambient invent / Care+ clone

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Lead digest opened ≥1× per coaching week | Ack stamped | Zero opens while “we have a digest” |
| Practice pack offered→inserted (no author rank) | Visible; dead packs retired | Packs published with no usage truth |
| Practice attest-code mix | `correct-as-written` share falls after pack/vocab fix | Codes exist; rollup absent |
| Filed notes with open completeness killers (practice) | Trend down after Check-your-note + L3 | Soft S2 forever invisible to Lead |
| Peer / ranked surfaces | Never | Any ship = trap sprung |
| Named person on floor from digest screenshot | Zero | Trust death (RDH lens + this lens) |

## Open questions for the owner

1. Confirm **no peer scoreboard** forever — including “temporary engagement experiments.”
2. Attest authority tiers: who may attest S2 vs killer class vs PHI override (second person)?
3. Is the coaching week cadence weekly digest-ack + one pack/vocab act — or something else?
4. Pack usage rollup: sufficient as practice-only, or also by visit-type without naming authors?

## Related

- `knowledge/sources/adversarial-rdh-surveillance-labor.md` (mirror lens — scoreboard = walkout)
- `knowledge/sources/team-lead-practice-packs-workflow.md` (usage rollup promised; never per-staff)
- `knowledge/sources/check-your-note-ux-research.md` (killer hoist; filing rollup; reject peer scoreboards)
- `knowledge/sources/high-stakes-documentation-patterns.md` (attest authority matrix; reason codes)
- Digest no-scoreboard doctrine: `src/app/digest/page.tsx` header comment
- Soft S2 copy: `src/lib/audit/types.ts` `SEVERITY_MEANING`
- Attest breadth: `src/components/builder/AuditPanel.tsx`
- Reason codes: `src/lib/standardize/reasonCodes.ts`
- Killers stay S2: `src/lib/audit/killers.ts`
