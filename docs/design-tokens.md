# Smile Notes — Design Tokens (production)

**Status:** Wired into product  
**Brand:** Purple ink on cream ground (`#3B2B66` / `#6D4AC4` / `#EDE9F6`)  
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

- **Primitives** are brand cream / navy / blue / teal / gold and the purple-tinted slate ramp. Class names stay `brand-*` and `slate-*` so high-contrast CSS selectors keep working.
- **Semantics** name intent: `action.primary` (Submit / filing), `action.complete` (Copy for EDR handoff), `surface.page`, `fg.brand`.
- **Components** consume semantics only. Feature code should not invent hex.

## Action split (deliberate)

| Role | UI | Why |
|------|-----|-----|
| `action.primary` | Submit (sticky header) | Files a legal record to the office |
| `action.complete` | Copy for Curve / EDR (Sidekick) | Clipboard handoff; must not look identical to Submit |

Severity colors (rose / amber / green) are **not** in this sheet — they live in `src/lib/audit/types.ts` and must stay one source of truth.

## Fast Lane

Home is the note. Fast Lane does **not** restore the old dashboard card grid as the front door. Featured visit scaffolds appear **inside the open builder** when the note is still Core-only: one tap applies modules (structure only), never clinical values.

## Change discipline

1. Change hex in `palette.ts` **and** `tailwind.config.ts` together.
2. Update `design-tokens.json` in the same PR.
3. Run contrast tests — CI fails on WCAG regressions.
