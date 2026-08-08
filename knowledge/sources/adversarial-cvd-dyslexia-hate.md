# Adversarial hate — color-blind + dyslexic chairside writer

- **Type**: red-team / adversarial perception + reading-load review (not live CVD or dyslexia sessions)
- **Ingested**: 2026-08-08
- **Tags**: accessibility, color-blind, cvd, dyslexia, andon, severity, typography, cream, spacing, chairside, red-team
- **Status**: fix backlog ready; shape + word + space must outrank hue
- **Method**: Hostile mock writer (deuteranopia/protanopia under operatory LEDs; dyslexia under time pressure; gloved tablet) instructed to **hate** Smile Notes. Grounded in shipped code: warm severity ramp (red/orange/amber), `ProgressRing` hue-only stroke, `text-[0.65rem]` chips, InterVariable density, cream ground `#EDE9F6`, Andon transfer/role essays in `BuilderShell`. **Not** observed Cornerstone CVD/dyslexia sessions — hypotheses to falsify with real writers.

## Axiom

Pairing a word with a hue does not forgive a **warm ramp that collapses**, a **percent ring that is only red/amber/green**, or a **cream fog of 0.65rem Inter**. If Stop and Required look like the same brick under deuteranopia, and the Andon card asks for a paragraph while the patient is rinsing, the note tool is not “honest” — it is a reading exam with a legal paste button.

**Why it matters:** Wrong severity rank under time pressure is the same class of miss as wrong tooth: the writer files past a hard stop they never *saw* as different from a soft review. Dyslexia multiplies every long clause. Fix **shape, text length, and spacing** on the default clinical path — not another lilac wash or longer explanation.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Chairside RDH / DA / DDS with red–green CVD and dyslexia; writes on a shared tablet between suction and rinse |
| Skill | WCAG non-text contrast + CVD-safe encoding; plain-language reading load; clinical wrong-gate human factors |
| Core hate | Severity that is hue-first (especially S0/S1/S2 warm neighbors); Inter micro-type; cream wash that erases edges; Andon prose that lectures instead of directing |

## Five hates

| # | Hate | Axis | Evidence in repo | Why it kills |
| --- | --- | --- | --- | --- |
| **1** | **Warm-ramp severity is hue theater for CVD** | Shape | `SEVERITY_RAIL` / `SEVERITY_CHIP`: S0 `red`, S1 `orange`, S2 `amber` — three adjacent warm hues. `severity-style.test.ts` only asserts **CSS string** uniqueness, not perceptual uniqueness under deuteranopia. Rails dominate the glance; chips are `text-[0.65rem]`. | Under red–green CVD, Stop / Required / Review collapse into one muddy brick. The “distinct appearance” test passes while the human cannot rank the gate. Color is not the spare channel — it is still the primary scan cue. |
| **2** | **ProgressRing: percent + hue, no shape change** | Shape | `ProgressRing.tsx`: stroke class toggles `text-red-500` → `text-amber-500` → `text-green-500`. Geometry is always the same circle. Label is `aria-label` only — the visible signal is color + tiny `%` digits. | Color-blind writer gets a pretty dial that does not change *form* when the note goes from blocked to handoff. Percent alone does not say “dentist must file.” Hue alone fails CVD. |
| **3** | **Inter density at `0.65rem` / `leading-snug`** | Spacing + text | Severity chips, Fast Lane cues, Check-your-note compact rows, Byte gauges, mobile audit subtitle — all ride `text-[0.65rem]`. Inter’s ss02/zero help `1`/`l`/`0`/`O`, then the UI **shrinks** the face until word-shape reading (what dyslexia relies on) dies. | Dyslexia reads by word shape and spacing. Crowded micro-Inter turns “Required” into a pill smear. Dose and tooth safety you bought with OpenType is spent buying density. |
| **4** | **Cream wash (`#EDE9F6`) softens every edge** | Spacing / ground | `BRAND.cream` page ground; Andon slabs `bg-amber-50` / `bg-slate-50` on cream; findings `bg-red-50/60` rails. Captions `text-slate-500` on cream sit at knife-edge contrast. | Operatory glare + lilac cream = low edge salience. CVD writers lose hue; dyslexic writers lose boundary. Everything becomes one warm fog. The brand paper look fights clinical scannability. |
| **5** | **Long Andon prose on the finish path** | Text | `BuilderShell` Andon card: multi-sentence role / transfer / Assessment–Plan copy (`leading-relaxed` essays). Finish line is short (`finishLine.ts`) — then the card **re-expands** into policy paragraphs plus nested “Ask a Team Lead…” branches. Finding rows stack `message` + `SEVERITY_MEANING` under every item. | Chairside time is seconds. A paragraph that explains license philosophy is a trap for dyslexia and a delay for everyone. Writers skim color instead of reading — which returns hate #1. |

## Five fixes (shape / text / spacing)

Effort = invasiveness. **Policy** = a color-blind dyslexic writer on the default path can rank Stop vs Review and act on Andon without decoding hue or reading an essay.

| # | Fix | Channel | Kills | Notes |
| --- | --- | --- | --- | --- |
| **1** | **Severity shape pack — not a warmer red** | Shape | 1, 2 | Per severity: large distinct mark (e.g. filled square Stop, triangle Required, diamond Review, circle Style, bar Info) **plus** the existing short word. Rails may keep hue as a *third* channel only. Extend `severity-style.test.ts` to assert **icon/shape token** uniqueness, not only class strings. |
| **2** | **ProgressRing form encodes state** | Shape | 2 | Blocked = broken/gap ring or square badge; handoff = arrow end-cap or dashed stroke; ready = closed ring. Keep `%` if useful; never let hue be the only delta. Visible text twin of `aria-label` beside the ring on mobile strip. |
| **3** | **Clinical type floor: ≥14px body, ≥1.5 line-height, no `0.65rem` on gates** | Spacing | 3 | Ban `text-[0.65rem]` on severity chips, finish strip, Check-your-note killer rows. Chip padding ≥8px vertical. Slight tracking on severity words. Keep Inter’s disambiguation features; stop spending them on density. |
| **4** | **Andon = one verb line + one control** | Text | 5 | Rewrite role/transfer Andon to Smart Brevity: **what blocks** (≤8 words) + **one button**. Move policy essays to HelpTip / reference. Finding row: message first; `SEVERITY_MEANING` once per severity group header, not under every duplicate Required. |
| **5** | **Clinical ground with edge, not cream fog** | Spacing / ground | 4 | Clinical builder surfaces: higher-contrast panel ground (near-white or cool slate-50) with clear 1px borders; reserve cream for chrome/marketing edges if brand needs it. Raise muted ink (≥ slate-600). Gap between finding rows ≥8px so word shapes do not merge. |

## The trap — “we already pair color with labels”

**Daylight cream + Inter micro-chips + warm severity ramp + StatusChip’s “color is always paired with icon and text” comment** is the trap.

It photographs as CVD-aware. `STATUS_META` icons and `SEVERITY_LABELS` look adult. The team can claim color-only severity was already fixed.

Then a deuteranopic dyslexic writer on a cream tablet gets: S0/S1/S2 rails that are three flavors of warm mud, a ProgressRing that only changes hue and percent, `Required` crushed to `0.65rem`, and an Andon card that asks them to read a license paragraph while the ring is still red-or-maybe-amber. They skim. They miss. They paste.

That is **encoding theater**: the label exists; the glance path still runs on hue and density. Do not “fix” this with a longer meaning sentence, a softer cream, or a fourth warm tint. Ship shape, shorten text, open spacing — or admit the finish path is for people who see red/green and like small Inter.

## Explicitly do not ship (CVD / dyslexia hate)

- Another warm hue between orange and amber “to help CVD.”
- Dark mode as the dyslexia fix under operatory glare.
- ALL-CAPS severity (already rejected — word shape dies harder).
- Longer Andon essays “so everyone understands transfer.”
- ProgressRing confetti / sparkle when the percent hits 100 while hue was the only cue.

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Grayscale (or CVD simulate) rank of S0 vs S1 vs S2 from shape+word alone | ≥90% correct in under 2s | Hue-only or chip-illegible |
| ProgressRing state ID with hue stripped | Blocked / handoff / ready distinct | Same circle, different stroke color only |
| Clinical gate type size | ≥14px / no `0.65rem` on chips | Micro-Inter pills |
| Andon action comprehension | Correct next tap from first line only | Must read paragraph |
| Finding list scan (5 Required + 1 Stop) | Stop found first without color | Cream fog + identical weight rows |

## Open questions for the owner

1. **Shape pack on severity** — accept slightly taller finding rows for CVD-safe marks?
2. **Cream off clinical canvas** — brand chrome keeps cream; builder panels go near-white?
3. **Andon one-liners** — move transfer policy to HelpTip without counsel pushback?

## Related

- `src/lib/audit/types.ts` (`SEVERITY_*` ramps, meanings)
- `src/lib/audit/severity-style.test.ts` (string uniqueness ≠ CVD uniqueness)
- `src/lib/status/draftStatus.ts` / `StatusChip.tsx` (icon+label pairing already present — still insufficient on glance path)
- `src/components/builder/ProgressRing.tsx`
- `src/components/builder/BuilderShell.tsx` (Andon card prose)
- `src/app/globals.css` (InterVariable + OpenType justification vs density spend)
- `knowledge/sources/eye-tracking-uiux-research.md` (scan path / cognitive load)
- Sibling panels (when merged): low-vision/motor a11y hate; practice-owner ROI hate
