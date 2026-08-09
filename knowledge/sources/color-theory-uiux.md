# Color theory for clinical UI — Smile Notes

- **Type**: applied research digest (WCAG + CVD + clinical Andon)
- **Ingested**: 2026-08-09
- **Tags**: color, cvd, wcag, severity, andon, daylight, accessibility, ux
- **Status**: drove the 2026-08-09 severity luminance + clinical-paper pass

## What the research requires

| Source | Claim that earns its keep here |
| --- | --- |
| WCAG 2.2 SC **1.4.1** Use of Color | Hue must never be the only channel for state (Stop / Required / Review / Ready). |
| WCAG 2.2 SC **1.4.3 / 1.4.11** | Text ≥4.5:1; meaningful UI chrome ≥3:1. Work **lightness**, not “a nicer red.” |
| CVD prevalence (~8% men deuteranomaly/deuteranopia) | Adjacent warm traffic-lights (red / orange / amber) collapse into one muddy brick. |
| Okabe–Ito / NHS Turas / Dynatrace status patterns | Prefer redundant encoding (shape + word + luminance). Bluish-green “clear” separates from vermillion “stop” better than lime-on-red. |
| Clinical Andon human factors | Severity rank under time pressure is a wrong-gate risk — same class as wrong tooth. |

## What Smile Notes already had

- Daylight brand chrome (cream / navy / note-blue / check-teal) — keep; not lilac SaaS.
- No dark mode under operatory glare (correct).
- Shape + word on severity chips and ProgressRing (Honest Finish).
- Contrast tests on brand + slate.

## Gaps this digest closes

1. **Warm severity ramp lacked a luminance ladder** — CSS-string uniqueness ≠ CVD uniqueness.
2. **S3 Style used stock blue** — collided with brand interactive blue on glance.
3. **Ready used stock green** — weak separation from Stop under deuteranopia vs bluish-green “clear.”
4. **High-contrast CSS hexes** (`#433e58` / `#565070`) drifted from `HIGH_CONTRAST` in `palette.ts`.
5. **Cream fog** — keep Daylight paper, cool it slightly so white cards and rails keep edges under LEDs.

## Design decisions (shipped)

| Decision | Choice | Why |
| --- | --- | --- |
| Severity fills | Named `severity-*` tokens with **monotonic luminance** on chip fills for S0→S1→S2 | Grayscale rank still climbs with urgency |
| S3 Style | Violet (`#6D28D9`), not brand blue | Hue + L separate Style from links/Submit |
| Ready / audit-clear | Bluish emerald (`#047857`) | Okabe-style clear; distinct from vermillion Stop |
| S2 Review chip | Amber fill + **dark ink** (not white) | Needed for L gap vs S1 while keeping AA text |
| Cream | `#F3F1EB` (cooler paper) | Less yellow fog; captions keep ≥4.5:1 |
| High contrast | Wire to `SLATE[700]` / `SLATE[600]` | One source of truth |
| Dark mode | Still rejected | Bright operatory |

## Explicit non-goals

- Another warm hue between orange and amber “for CVD.”
- Purple-on-white marketing theme.
- Inverting the app to dark mode.
- Encoding severity only in brand chrome (navy/teal).

## Falsifiers

- Chip-fill relative luminance strictly increases S0 < S1 < S2.
- White (or dark ink on S2) clears WCAG AA on every severity chip.
- `SEVERITY_SHAPE` remains unique; ProgressRing still shows word + shape.
- High-contrast CSS hexes match `HIGH_CONTRAST` in `palette.ts`.
- Brand navy/blue/teal still clear AA on cream and white.

## Related code

- `src/lib/theme/palette.ts`, `tailwind.config.ts`, `design-tokens.json`
- `src/lib/audit/types.ts` (`SEVERITY_*`)
- `src/lib/status/draftStatus.ts`, `ProgressRing.tsx`
- `src/app/globals.css` (`[data-contrast="high"]`)
- Sibling: `adversarial-cvd-dyslexia-hate.md`, `adversarial-hate-codesign.md`
