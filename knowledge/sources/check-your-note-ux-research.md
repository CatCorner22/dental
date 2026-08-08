# Check-your-note — capability + UI/UX research (next enhancement)

- **Type**: decision research (capability + UI/UX), grounded in existing digests and current builder code
- **Ingested**: 2026-08-08
- **Tags**: ux, chairside, check-answers, litigation, completeness, copy-handoff, submit-gate, poka-yoke
- **Status**: recommendation ready; not yet implemented

## Axiom

The next high-value change is a **“Check your note” finish summary** at Copy / Submit — not a new module, not Curve write-back, not ambient AI.

**Why it matters:** Audit rules already flag the litigation killers. Staff still clear a live findings strip under time pressure and paste into the EDR without a reconstructible confirm step. That is the WCAG 3.3.4 / GOV.UK check-answers gap this codebase has not closed.

## What just shipped (do not rebuild)

| Shipped | Where |
|---|---|
| Handoff Andon honesty (`Waiting for dentist`, finish-line copy) | showtime / `finishLine`, StatusChip |
| Practice packs Workflow v1 | `/workflow`, pack ranking of Fast Lane / starters |
| Section starters + pinned My blocks | `SuggestedBlocks`, `PinnedMyBlocks` |
| Omission-licence chips | `omissions.ts` |
| apiReady + AbortController on probes | `apiReady.ts`, ByteStar / packs fetches |
| UIX-001–011 inspection findings | `docs/ui-ux-inspection/` (resolved) |

## Decision

**Ship #1: Check-your-note finish summary + killer-item hoist** inside the existing Copy / Submit gate.

Problem today: export confirm is mostly “two identifiers in the right chart.” Findings stay in a scrollable Sidekick. Killer completeness gaps (`complete.consent-*`, `complete.anesthetic-no-amount`, `complete.imaging-no-interpretation`, `complete.clinical-rationale`) are easy to file past when the chip says Ready or Handoff.

## Evidence (already in the knowledge base)

- Doctors Company claim cohort: when documentation is insufficient, **findings / informed consent / clinical rationale** dominate (`litigation-documentation-research.md`).
- MedPro sparse chart: “RCT complete #30 with local” — missing anesthetic amount, consent process, imaging interpretation (`litigation-documentation-research.md`).
- High-stakes patterns explicitly ranks: *“A ‘Check your note’ summary before copy/paste. This is the cheapest high-value UI item here.”* (`high-stakes-documentation-patterns.md`).
- GOV.UK / NHS check-answers + WCAG 3.3.4 *Confirmed* — confirm what will leave, with Change links back to fields.
- Rules already encode the killers in `src/lib/audit/rules/completeness.ts`; omissions + finishLine already exist.

## Ranked backlog

| # | Item | Type | Effort | Notes |
|---|---|---|---|---|
| **1** | Check-your-note finish summary + killer hoist | UI/UX + light capability | M | Top pick |
| 2 | Scoped READBACK_CLASS on Standardize / assist Accept | Capability + UI | M | Confirm changed teeth/doses/laterality only |
| 3 | Reason codes on attestation / PHI override | Capability | S | Aggregable for Lead digest |
| 4 | Fast Lane → optional attested pack starters | UI/UX | M | Offer after module apply; never silent dump |
| 5 | Practice filing rollup (modules + finding categories) | Capability | M | Falsify whether #1 worked; no per-staff scores |
| 6 | Tablet Copy polish + Lead readiness strip | UI/UX | S–M | Go-live “Next” residual |
| 7 | Independent verification for killer attest + PHI override | Capability | L | Needs owner policy |
| 8 | Amendment chain `amendsSubmissionId` | Capability | L | Reviewer trail; no rewrite of frozen text |

## First slice for #1

1. Tag ~8–12 rules `killer: true` (wrong-site / dose / consent thin or no-decision / anesthetic amount / imaging interpretation / clinical rationale). Prefer metadata on existing rules over new severities.
2. Pure helper: `AuditReport` + omissions + selected modules → ordered rows (killers and S0/S1 first).
3. Insert one step above Copy / Submit confirm in `BuilderShell` / `BuilderDialogs`: modules used, killer rows with **Change** → existing jump-to-field, open stops, omission-licence count.
4. Adversarial tests: sparse MedPro-style note cannot Confirm while anesthetic/consent killers are open; hygienist handoff notes still show dentist-must-file.

Touches: builder dialogs + small helper under `src/lib/status/` or `src/lib/audit/`. No transformer rewrite. Bump `RULESET_VERSION` only if killer tags change stamped audit semantics.

## Reject / park

| Idea | Why |
|---|---|
| Ambient / Care+ AI note generation | Coded non-goal; PHI |
| Curve / EDR write-back | Charter: paste + two-ID handoff |
| Curve Forms freeform staff fields | Audit-blind dialects |
| Silent Fast Lane clinical fill | Invents facts |
| Peer scoreboards on home | Charter |
| Voice Phase 2 Whisper **now** | Engine seam ready; eval corpus first |
| MFA default-on as the “big” bet | Feature exists; ops gate |
| Pharmacy DEA / CERT / multi-state engines | Parked in documentation-integrity digest |
| Rebuilding showtime / packs v1 / section starters | Already on `main` |

## Open questions for the practice owner

1. Is the ninety-second path mostly **tablet Copy → Curve paste**, or desktop Submit-email?
2. Confirm the killer hoist list (or a shorter counsel list).
3. Defer independent verification (#7) until after pilot metrics?
4. After Fast Lane apply: optional pack-starter offer, or ranking-only?
5. Who gets dentist / hygienist / assistant roles before pilot (unset = weak scope lock)?

## Measurement (falsifiable)

**Primary:** Among notes that reach Copy/Submit with ≥1 open completeness/consent finding, the share that complete export **without** clicking any summary **Change** link should fall vs a two-week baseline.

**Guardrail:** Median ready→clipboard time should not rise >20%.

**Not a success metric:** “Lawsuits prevented” (negative proof; see litigation digest epistemic frame).

## Related sources

- `knowledge/sources/high-stakes-documentation-patterns.md`
- `knowledge/sources/litigation-documentation-research.md`
- `knowledge/sources/go-live-ux-command-check.md`
- `knowledge/sources/builder-text-blocks-predictive-ux.md`
- `docs/ui-ux-inspection/` (UIX resolved — this research is net-new finish discipline)
