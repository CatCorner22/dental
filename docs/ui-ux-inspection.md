# UI and UX inspection — clutter pass

**Skill:** `.cursor/skills/ui-and-ux-inspection` · **Build:** production (`next build`) · **Browser:** Firefox 1440×1000 · **Account:** admin fixture · **Date:** 2026-08-04

## Executive summary

The reported clutter had one dominant, measurable cause: the dashboard — the primary "start or resume a note" screen — rendered **4,167 px** tall because the Word Map opened its 87-row "terms of art" group on load, stacking a two-column reference wall beneath the draft list. Collapsing the reference by default (progressive disclosure) cut the dashboard to **1,201 px, a 71% reduction**, with no loss of function: the index is still present, searchable, and one click from any category. This is the smallest effective remedy and the highest-impact one available.

A caffeinated adversarial persona ("Twitch") ran three frantic laps across eleven routes — rage double-clicks, garbage in every field, six-click submit races, mid-load Back-button mashing — and produced **zero uncaught errors, zero 5xx responses, and zero horizontal overflow**. The app is robust under abuse; the issue was density, not fragility.

## Scope and limitations

Static hierarchy inspection plus runtime measurement in one engine at two states (empty and populated dashboard). Not a substitute for moderated testing with real staff; the height figures are measured, the usability benefit is expected and stated as such (UIX metric discipline).

## Critical findings table

| id | title | severity | confidence | status |
|---|---|---|---|---|
| UIX-001 | Reference Word Map opens 87 rows on the primary action screen | moderate | high | fixed |

No critical or high findings. Twitch surfaced no functional defects.

## Finding UIX-001 (fixed)

- **Category:** minimal & hierarchical presentation (UIX-H08), efficiency & progressive disclosure (UIX-H07)
- **Route:** `/` (dashboard)
- **User process:** "Start or resume a note in one click."
- **Evidence (observed, runtime):** dashboard `scrollHeight` 4,167 px; the Word Map's first group rendered all 87 term-of-art rows on load; the draft list sat above a reference wall that dominated the fold-plus-three-screens.
- **User impact:** increased scanning cost and scroll distance to the actual job of the screen; the reference competed with the primary action. Task success not blocked (workaround: scroll), so severity is moderate, not high.
- **Root cause:** `WordMap` initialized `openId` to the first group id, contradicting the component's own search-first premise ("not reading 200 rows top to bottom").
- **Remediation applied:** initialize collapsed (`openId = null`). Search still expands all matching groups; the count line still advertises the full 273-entry total; a category expands on click.
- **Verification:** dashboard re-measured at 1,201 px (−71%); full suite 1,905/1,905 green; Twitch re-safe (no overflow introduced).

## Accessibility

No regression. The collapse control keeps `aria-expanded`/`aria-controls`; forced-colors and reduced-motion rules are untouched. The change removes content from the initial tab order rather than adding any.

## Performance

Strictly positive: 87 fewer list rows and their grid layout are no longer built on dashboard load. No new script or request.

## Privacy

No change. No new collection; the Word Map is static controlled vocabulary, no PHI.

## Verification checklist

- [x] Dashboard height reduced (4,167 → 1,201 px), measured
- [x] Word Map still searchable and expandable
- [x] `npx tsc --noEmit` clean
- [x] 1,905 tests pass
- [x] Adversarial persona: 0 errors / 0 5xx / 0 overflow across 11 routes ×3 laps
- [x] Production build clean

## Proposed next experiments (not implemented; owner's call)

- Consider relocating the Word Map to a compact "Quick reference" affordance if telemetry later shows it is rarely expanded from the dashboard. Gate on measured expand rate, not assumption.
