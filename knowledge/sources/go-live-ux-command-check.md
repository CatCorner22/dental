# Go-live UX — Project Command Center track check

- **Ingested**: 2026-08-06
- **Type**: orientation / decision log (not a falsifiable experiment)

## What changed → Why it matters

Main already absorbed SuperByte nav UX (#87), Chicken Little skills (#88), section starters (#85), packs research (#86). Mid-flight go-live hardening was accumulating unmerged inventory. Command check redirected work to one vertical slice: false incomplete locks, honest dentist handoff, tablet finish line, unset-role Andon, feedback modal de-gauntlet.

## Evidence examined

- Stakeholder swarm (hygienist / assistant / dentist / lead / front desk)
- `approval.ts` vs `canTransferNotes` (lead-only transfer API)
- Partial WIP on `cursor/go-live-ux-hardening-4966`

## Decision

Stay on go-live **testing** readiness, not feature sprawl. Ship the vertical slice. Do not invent owner-self-transfer without an explicit policy decision (copy told hygienists to transfer; API refuses them — UI must tell the truth).

## Intervention log

| Intervention | Why | Evidence invalidated |
| --- | --- | --- |
| Stopped broad agent swarm mid-flight | User asked for track check | Incomplete explore agents — not treated as validated findings |
| Declined fake Transfer button for hygienists | API is lead-only | Would have been theater UX |

## Now / Next / Later / Watch

- **Now**: Merge go-live UX slice; set clinical roles on pilot accounts; set `AI_GATEWAY_API_KEY` if SuperByte pioneer is in scope
- **Next**: Tablet Copy path polish; lead readiness strip; formal Bugbot or Security `/review` (user must choose)
- **Later**: Practice packs workflow impl (stashed WIP); owner-self-transfer policy if Lead bottleneck appears in pilot
- **Watch**: Unset-role accounts in pilot; feedback modal once-per-browser may be too quiet for some sites
