# Adversarial hate — accessibility / low-vision / motor advocate

- **Type**: red-team / adversarial accessibility review (not live AT sessions)
- **Ingested**: 2026-08-08
- **Tags**: accessibility, wcag, low-vision, motor, tremor, gloves, screen-reader, motion, contrast, chips, clinical-safety, red-team
- **Status**: fix backlog ready; default-path AA is the policy lock
- **Method**: Hostile mock advocate (low vision, glove+tremor motor impairment, VoiceOver/TalkBack user, vestibular sensitivity) instructed to **hate** Smile Notes. Grounded in shipped code: cream ground `#EDE9F6`, `.chip` / `.tap` / ToothPicker, AuditPanel finding rows, `aria-disabled` finish controls, `[data-contrast="high"]` opt-in on `/account`, sparkle-pop / reduced-motion. **Not** observed Cornerstone AT sessions — hypotheses to falsify with real glove+screen-reader runs.

## Axiom

Your contrast tests do not forgive your **defaults**. Clinical a11y is not a settings page on `/account` after someone already mis-tapped tooth 14 for 15. If a writer cannot **see** the caption, **hit** the chip through a glove, or **hear** why Submit is dead, the note is not “honest” — it is a pretty trap that invents the wrong site into a legal record.

**Why it matters:** Litigation panels hate false confidence. A11y hate is the same failure mode with different victims: wrong tooth, unread gate, unannounced Ready chip, sparkle while the hand is mid-press. Fix the **default path**, or Daylight cream is ableism with a CI badge.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Aging RDH / DDS with low vision under operatory glare; gloved + mild tremor; sometime screen-reader / keyboard path; vestibular intolerance to celebratory motion |
| Skill | WCAG 2.2 AA + clinical wrong-site human factors |
| Core hate | Cream low-contrast captions; pill chips that only grow for `pointer: coarse`; tooth cells that admit mistap is a legal error; mouse-only audit jumps; high-contrast buried behind login; motion that “respects” reduced-motion by shortening duration while still transforming |

## Six WCAG / clinical a11y kills

| # | Kill | WCAG / clinical | Evidence in repo | Why it kills |
| --- | --- | --- | --- | --- |
| **1** | **Cream captions at the razor edge; “fix” is opt-in** | **1.4.3** Contrast (Minimum); clinical: unread help under task light | `BRAND.cream` `#EDE9F6`; `text-slate-500` on cream ≈ **4.507:1** (pass by thousandths). `contrast.test.ts` itself documents slate-400 as failing (~2.4–2.9:1) and that the high-contrast swap was scoped to `[data-contrast="high"]` only. Toggle lives on `/account` (`DisplaySettings`), not chairside. Shared device keeps **last person’s** prefs. | You measured your own failure and gated the cure behind a scavenger hunt. Default writers get captions that die under glare. Low vision does not “go find Account.” |
| **2** | **Tiny chips / micro labels on the path that inserts clinical text** | **2.5.8** Target Size (Minimum); **1.4.4** Resize; clinical: wrong phrase / wrong block into chart | `.chip` = `px-2 py-0.5 text-xs` until `@media (pointer: coarse)` bumps to 44px. Severity chips use `text-[0.65rem]`. Fast Lane cue `text-[0.65rem] text-slate-500`. Phrase / Block / My blocks chips ride `.chip`. Fine-pointer tablet, stylus, or desktop = **crumbs**. | Glove + tremor do not care that your mouse pointer is “fine.” Missed chip → wrong scaffold language → Curve paste of fiction. |
| **3** | **ToothPicker: dense legal anatomy controls** | **2.5.8** / **2.5.5**; clinical: **wrong-site = S0** | Cells `h-8 min-w-8` + `gap-1`; comment in `ToothPicker.tsx` admits adjacent mistap is “a documentation error in the legal record.” `.tap-sq` grows only under coarse pointer. Selection live region exists — **after** the miss. | This is not a UX nit. This is how wrong-site enters the record with a fat finger. Your own comment is the indictment. |
| **4** | **Audit finding rows are mouse theater** | **2.1.1** Keyboard; **4.1.2** Name, Role, Value; clinical: cannot reach the field that blocks filing | `AuditPanel` `<li onClick={jump}>` — no `role="button"`, no key handler. Nested attest controls required `stopPropagation` because the row **eats** taps (documented in-file). Keyboard / SR users get a fragile “Go to field” link pattern while the primary hit target is a list item. | Screen reader and keyboard writers cannot reliably jump to the S0/S1 field. Attestation UI already proved the click-parent is hostile. |
| **5** | **Finish path: `aria-disabled` at 40% opacity + quiet status chips** | **1.4.3**; **4.1.3** Status Messages; clinical: Ready/blocked mismatch | Submit / Copy use `aria-disabled` (good: stays focusable) but CSS forces `opacity-40` — washed label fails readable contrast while still in tab order. `StatusChip` is visual icon+label; Andon / gate changes are not a consistent assertive live announcement of **why filing is dead**. | Low vision sees a ghost button. SR may land on it and still not get a durable “what blocks me” without hunting `aria-describedby`. Pretty Ready chip + unreadable disabled Submit = false confidence’s cousin. |
| **6** | **Motion still moves under “reduced motion”** | **2.3.3** Animation from Interactions; clinical: mid-press distraction | Global rule sets `animation-duration` / `transition-duration` to `0.01ms` — **does not** disable `transform` / `scale` / `translate`. `.sparkle-pop` still scales/rotates; buttons `active:translate-y-px`; Fast Lane cards hover-lift. Audit jump correctly gates `scrollIntoView` smooth vs auto — then sparkle celebrates clean Andon. | Vestibular / tremor users get a control that still jumps under the glove. Celebrating a clean note with a pop while the next tooth is being selected is contempt dressed as delight. |

## Five fixes (do these; stop polishing cream)

Effort = invasiveness. **Policy** = default path must meet AA without `/account` pilgrimage.

| # | Fix | Kills | Notes |
| --- | --- | --- | --- |
| **1** | **Default AA captions with margin — not opt-in charity** | 1 | Raise default muted text to ≥ slate-600 on cream (≥6:1). Keep Stronger contrast for borders/focus/AAA. Stop treating 4.507 as a trophy. Assert **margin**, not knife-edge. |
| **2** | **Clinical controls ≥44×44 always + ≥8px gap** | 2, 3 | Chips, dentition tabs, phrase/block inserts, tooth cells: size for glove on **all** pointers. `pointer: coarse` is a bonus, not the gate. Density is not a clinical virtue. |
| **3** | **ToothPicker miss-recovery** | 3 | Fat cells; selected state that survives glare; undo / clear adjacent; keep (strengthen) live “Selected:” announcement; optional confirm step for single-tooth irreversible procedures. Wrong-site prevention > aesthetic grid. |
| **4** | **Audit findings as real operable controls** | 4, 5 | Each finding is a button (or link) with accessible name = severity label + message + meaning. Keyboard Enter/Space jumps. Kill clickable `<li>`. Announce open S0/S1 count via `aria-live` when gates flip. |
| **5** | **Clinical path: motion off by default; transforms die under reduce** | 6 | No sparkle on filing path. Under `prefers-reduced-motion: reduce`, set `animation: none`, `transition: none`, `transform: none`. Chairside finish is an instrument, not a confetti demo. |

## The trap — pretty but inaccessible

**Daylight cream + capsule chips + contrast CI + “we have high contrast and 44px taps”** is the trap.

It photographs as caring. `contrast.test.ts` and `.tap` media queries look like adult engineering. The product page can claim WCAG intent.

Then a gloved low-vision writer on a fine-pointer iPad gets: lilac wash, 4.5-by-a-hair captions, `text-[0.65rem]` severity pills, tooth cells that your own comment calls legal-risk mistaps, audit jumps that only mice love, and a Stronger-contrast cure parked on **Account** after the miss already hit the draft.

That is accessibility **theater**: the tests pass on the palette you chose; the human fails on the path you shipped. Do not “fix” this with more sparkle, more cream depth, or a second marketing skin. Fix the default clinical controls or admit the product is for young eyes and steady mouse hands.

## Explicitly do not ship (a11y hate)

- Dark mode as the “a11y win” in a bright operatory (your own globals.css already knows this — do not reverse it for fashion).
- Color-only severity without word + meaning (keep pairing; enlarge the chip, don’t delete the label).
- Soft “training mode” that shrinks targets further.
- Hiding high-contrast behind Account while default stays knife-edge.
- More celebratory motion on clean Andon.

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Default caption contrast on cream | ≥ 6:1 with CI margin | Knife-edge 4.5 “pass” |
| Tooth / chip hit rate under glove proxy (fat stylus, 44px needed) | Adjacent miss → recoverable | Silent wrong tooth in draft |
| Keyboard-only: jump from each open S0/S1 to field | 100% | Mouse-only `<li>` |
| Gate change announced to AT when Submit blocks | Reason heard without extra hunt | Ghost `opacity-40` button only |
| Reduced-motion: no transform on finish controls | None | Sparkle / press translate remains |

## Open questions for the owner

1. **Default muted ≥ slate-600** — accept a slightly heavier UI to stop knife-edge AA?
2. **Always-44 clinical chips** — accept fewer chips per row for glove safety?
3. **Tooth confirm on single-select surgical fields** — friction vs wrong-site?

## Related

- `knowledge/sources/adversarial-hate-panels.md` (multi-persona hate; glove-first already P0)
- `knowledge/sources/high-stakes-documentation-patterns.md` (WCAG 3.3.4 / check-answers)
- `src/lib/theme/contrast.test.ts` (self-indictment of opt-in high contrast)
- `src/app/globals.css` (`.chip`, `.tap`, reduced-motion duration hack, sparkle-pop)
- `src/components/builder/fields/ToothPicker.tsx`
- `src/components/builder/AuditPanel.tsx`
- `src/components/shell/DisplaySettings.tsx`
