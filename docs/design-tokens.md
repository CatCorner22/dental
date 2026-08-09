# Smile Notes — Design Tokens (production)

**Status:** Wired into product  
**Brand:** Daylight chart — cooler paper / space navy / note blue / check teal (`#F3F1EB` / `#1E3A5F` / `#2B6CB8` / `#0F766E`); severity luminance ladder in `severity.*`  
**Sources of truth**

| Layer | File |
|-------|------|
| Primitive hex | `src/lib/theme/palette.ts` + `tailwind.config.ts` |
| Semantic roles | `src/lib/theme/tokens.ts` |
| DTCG export | `design-tokens.json` |
| Component CSS | `src/app/globals.css` (`.btn-primary`, `.btn-complete`, `.fast-lane-card`) |
| Contrast CI | `src/lib/theme/contrast.test.ts`, `src/lib/theme/tokens.test.ts` |

## Architecture

```text
Primitive  →  Semantic  →  Component
(palette)     (tokens)     (CSS / JSX classes)
```

- **Primitives** are brand cream / navy / blue / teal / gold and the cool slate ramp. Class names stay `brand-*` and `slate-*` so high-contrast CSS selectors keep working.
- **Semantics** name intent: `action.primary` (Submit / filing), `action.complete` (Copy for EDR handoff), `surface.page`, `fg.brand`.
- **Components** consume semantics only. Feature code should not invent hex.

## Action split (deliberate)

| Role | UI | Why |
|------|-----|-----|
| `action.primary` | Submit (sticky header) | Files a legal record to the office |
| `action.complete` | Copy for Curve / EDR (Sidekick) | Clipboard handoff; must not look identical to Submit |

Severity / Ready colors live as `severity.*` primitives (luminance ladder) and are consumed by `src/lib/audit/types.ts` + draft status chips — still one source of truth, never re-derived per screen.

## Fast Lane

Home is the note. Fast Lane does **not** restore the old dashboard card grid as the front door. Featured visit scaffolds appear **inside the open builder** when the note is still Core-only: one tap applies modules (structure only), never clinical values. My blocks are pinned on builder chrome above Fast Lane.

## Change discipline

1. Change hex in `palette.ts` **and** `tailwind.config.ts` together.
2. Update `design-tokens.json` in the same PR.
3. Run contrast tests — CI fails on WCAG regressions.
