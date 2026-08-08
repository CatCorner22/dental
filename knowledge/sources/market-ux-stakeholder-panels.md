# Market UX research + mock agentic stakeholder panels — Smile Notes appeal

- **Type**: market research + simulated multi-stakeholder critique (not live interviews)
- **Ingested**: 2026-08-08
- **Tags**: ux, ui, market, dental-pms, stakeholders, chairside, brand, tablet, adoption
- **Status**: recommendation ready; visual/token recommit needs owner decision lock
- **Epistemic note**: Stakeholder “panels” are structured agent simulations grounded in shipped product surfaces, prior digests, and public market sources. They are **not** observed Cornerstone staff sessions. Treat as prioritization hypotheses to falsify in a ninety-second chairside watch (`knowledge/artifact/cornerstone-dental-arts.md` §6).

## Axiom

Dental offices adopt Smile Notes when it feels as **fast as Curve Favorites** and as **serious as a legal chart** — not when it looks like generic purple AI SaaS or a marketing landing page.

**Why it matters:** Market winners in 2026 sell cloud polish + templates + tablet reach (Curve). Legacy depth still wins complex billing (Dentrix). Clinician EHR literature still ties low usability to burnout. Smile Notes already ships trust rails (Andons, Check-your-note, attested blocks). The adoption gap is **identity + thumb-speed + first-hour welcome**, not more severity colors.

## Market synthesis (public sources, 2025–2026)

| Signal | Implication for Smile Notes |
| --- | --- |
| Curve praised for modern web UX, graphical charting, **custom note templates / Favorites**, fast staff onboarding | Compete on *attested* scaffolds + discoverability — never silent Forms dump or write-back |
| Dentrix = depth + steeper learning curve; Open Dental = flexible/dated UI | “Serious instrument” beats “cute startup”; avoid looking toy-like next to PMS chrome |
| Cloud + tablet / multi-op access is a purchase driver | Tablet finish strip + glove targets are product, not polish |
| Ambient / AI charting is the industry hype lane; liability and re-entry kill trust when wrong | Hold Never list; sell gated assist + deterministic locks as the *modern* liability-aware path |
| EMR usability surveys: response time, alert noise, error prevention, collaboration differentiate products | Calm density, honest Andon, one next action > more chips |
| Operatory design systems emphasize ≥44px targets, pastel severity rails, no dark-mode glow | Aligns with existing coarse-pointer work; finish the *look* of the finish path |
| Chairside document UX: few clicks from chart to what you need; temps productive in one shift | Role-before-work + one-shift Fast Path |

Sources sampled (non-exhaustive): Curve usability / 2026 PMS comparisons (Operatory, US Tech Automations, Operaitor); EMR usability / burnout literature (NPJ Digit Med 2025 survey; BMJ HCI go-live SUS; industry UX guides); dental chairside / tablet design notes (DentalPin design system, operatory touch-target practice).

## What Smile Notes already is (do not rebuild)

| Strength panels kept | Where |
| --- | --- |
| Home is the open note | `src/app/page.tsx`, BuilderShell |
| Copy (teal complete) vs Submit (primary) | design tokens / finish strip |
| Check-your-note killers | `#101`, `CheckNoteSummary` |
| Fast Lane modules + optional attested pack starters | `#104` |
| Honest handoff / unset-role Andon | go-live digests |
| Anti-scoreboard digest + filing rollup | `#106` |
| Inter + OpenType for doses/teeth; sentence case; no dark theme | `globals.css`, `casing.ts` |
| Never: ambient invent, Forms clone, write-back, peer scoreboards | prompts + research digests |

## Visual identity fracture (cross-panel)

Live tokens (`palette.ts`): lilac ground `#EDE9F6`, purple ink/interactive.  
Documented brand (`docs/brand.md`): cream paper, note blue, check teal, orbit coral.

**Panels agree:** the atomic molar mark is the proprietary signal; purple SaaS chrome is replaceable and sits in the “AI product purple” cliché. Staff trust the *stops*; they do not yet *want* the shell.

## Four mock panels (summaries)

### A. Hygienists + assistants (tablet / between patients)

- **Liked:** home = note; Copy vs Submit; Check-your-note; honest Andons; no inventing findings.
- **Friction:** lilac Inter cards feel like a second EHR; Fast Lane emptier than Curve Favorites; targets small for gloves; starters/My blocks under-discovered; attest lists feel like homework when long.
- **Top asks:** glove-first finish strip; Favorites-shaped pack offer (already shipping — push discoverability); pinned My blocks; visual calm toward cream/navy/teal; one-line “Next” on tablet.
- **Reject:** ambient AI findings; Curve write-back / Forms clone / silent fill / home scoreboards.
- **Surprise:** they don’t hate gates — they hate **reading under time pressure**. Fewer words + bigger targets at the gate.

### B. Dentists + owner + office manager

- **Liked:** killer hoist; Andon honesty; anti-scoreboard digest; severity ≠ brand; gated AI.
- **Friction:** still slower than QuickText; Lead transfer bottleneck; rollup needs “coach this week”; unset role breaks first impression.
- **Top asks:** Check-your-note as *instrument* (shipped — keep lean); honest handoff chrome; tablet Copy with purposeful motion; filing rollup coaching; sell deterministic standardization vs ambient.
- **Reject:** ambient Care+ notes; staff scoreboards.
- **Surprise:** **instrument seriousness is a speed feature** — if it looks like a wellness app, they won’t trust the stop.

### C. Design / dental IT / SaaS critic

- **Verdict:** interaction discipline ahead of identity.
- **Direction name: “Daylight chart”** — cool paper or recommitted cream; space navy + note blue + check teal; coral/gold only at brand edges; Inter clinical + one display face on marketing/empty only.
- **Ranked upgrades:** (1) font split (2) marketing vs work skins (3) builder chrome token recommit (4) tablet finish look (5) empty states (6) purposeful motion.
- **Hard no’s:** purple-as-identity long-term; cream+serif+terracotta lifestyle; dark/glow; marketing heroes inside the builder; display type on clinical fields; severity as fashion.

### D. New grad + temp + onboarding coordinator

- **Liked:** cursor-ready note; Standardize diff; role-scoped scaffolds when role is set; visible Andon for coordinators.
- **Friction:** unset-role amber as first emotional beat; checklist that leaves the note on hour one; no in-flow escalate when Lead is away.
- **Top asks:** role-before-work gate; one-shift Fast Path for temps; hard-stop WHAT/WHY/HOW pedagogy; coordinator readiness strip; role-aware first-week checklist.
- **Reject:** training mode that disables audit; LMS tours before the note; gamified confetti on stops; fake transfer; auto-apply Standardize.

## Cross-cutting ranked backlog (appeal + modern UI)

Effort = technical invasiveness, not calendar time. Charter constraints apply.

| # | Item | Type | Effort | Panel drivers | Notes |
| --- | --- | --- | --- | --- | --- |
| **1** | **Brand/token recommit — “Daylight chart”** | UI | M | A, B, C | Sync `palette.ts`, Tailwind, `BrandMark`, `docs/brand.md`. Kill lilac-purple identity. Work = paper/navy/teal; edges = atomic mark. Owner decision lock required. |
| **2** | **Glove-first tablet finish** | UI/UX | S–M | A, B, C | ≥44px already partial — fat Copy, killer-only residual, one “Next” line, fewer nested card rings on coarse pointer. Go-live residual #6. |
| **3** | **Role-before-work + coordinator readiness strip** | UX | M | B, D | Unset role must not be the first viewport emotion; Lead/admin sees who is unset before Monday. |
| **4** | **Pinned My blocks (3–5) always visible** | UX | S | A | Curve QuickText analogue; role-filtered; already researched in packs/builder digests. |
| **5** | **Hard-stop pedagogy compact** | UX copy | S | D | WHAT / WHY / HOW one-liners; first-of-day expand once. No severity change → no RULESET bump if messages only. |
| **6** | **Marketing vs work surface split** | UI | S–M | C | Login/empty/display type; builder stays Inter/clinical. Brand-first only on non-record surfaces. |
| **7** | **One-shift temp Fast Path** | UX | M | D | Role-filtered 3-step strip; checklist collapse — not audit soft mode. |
| **8** | **Purposeful motion (2–3 beats)** | UI | S | B, C | Module expand, Submit press, queue-clear sparkle; honor reduced motion. |
| **9** | **Pack usage rollup (Workflow)** | Capability | M | B | After Fast Lane starters — offered vs inserted; practice-level only. |
| **10** | Independent verification / amendment chain | Capability | L | B | Prior research #7–#8; needs owner policy — not “appeal” first. |

### Explicitly park (market pressure ≠ product)

| Temptation | Why panels + charter reject |
| --- | --- |
| Ambient AI note generation | Liability; Never list; unanimous reject |
| Curve / EDR write-back | Wrong-chart risk; charter |
| Staff Forms freeform builder | Audit-blind dialects |
| Dark mode / glass / glow | Operatory + brand rules |
| Home scoreboards / streaks | Poisons coaching; charter |
| Soft “training mode” without hard stops | Wrong muscle memory |

## Recommended first shipping slice (after owner lock on #1)

If the owner **accepts Daylight chart**: implement token + BrandMark + brand.md sync, then glove-first tablet finish (#2) in the same visual language.

If the owner **defers palette recommit**: still ship #2 + #4 + #5 (tablet finish, pinned My blocks, stop pedagogy) — high appeal, low identity risk.

Do **not** ship a landing-page hero inside the builder to satisfy “cutting edge.” Cutting edge here = **daylight clinical instrument + Favorites-speed attested scaffolds + first-hour role clarity**.

## Measurement (falsifiable)

1. **Temp time-to-first Copy** (role set → clipboard) falls vs baseline week.
2. **Unset-role Andon rate** on scheduled writers → near zero by Monday open.
3. **Side-by-side brand test:** screenshot not confusable with generic purple SaaS *or* kids’ dental marketing.
4. **Guardrail:** median ready→Copy time must not rise >20% after visual refresh.
5. **Not a success metric:** “looks modern” in an internal design critique alone.

## Open questions for the practice owner

1. Recommit to cream/navy/teal/coral (`docs/brand.md`), or ratify lilac-purple as intentional identity (panels advise against)?
2. Is the ninety-second path still tablet Copy → Curve (panels assume yes)?
3. Who sets clinical roles before a temp’s first patient (coordinator KPI)?
4. Display typeface choice for marketing/empty only — owner taste lock?

## Related sources

- `knowledge/sources/check-your-note-ux-research.md`
- `knowledge/sources/builder-text-blocks-predictive-ux.md`
- `knowledge/sources/go-live-ux-command-check.md`
- `knowledge/sources/ui-ux-swarm-work-of-art.md`
- `knowledge/benchmarks/ux-performance-review.md`
- `docs/brand.md`, `docs/design-tokens.md`, `src/lib/theme/palette.ts`
