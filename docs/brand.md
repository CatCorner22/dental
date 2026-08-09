# Smile Notes brand assets

Original works, hand-authored as SVG vector paths in [`public/brand/`](../public/brand/).
No stock art, no third-party elements, no AI-generated raster imagery — the marks are
human-reviewable vector source, which is the form you want for a copyright deposit.

## The mark

**Concept: "the note that checks itself" — atomic-age edition.** A note card (writing
rules at the top-left) holds a squat, friendly molar with a smile on its crown, riding
an **atomic orbit** with a satellite spark; a teal verification badge overlays the
corner and gold starbursts celebrate. It compresses the whole product into one image:
a clinical note, kept friendly, that does not leave the tool until it has been checked.

**The retro-future rule: geometry, not costume.** The Space-Age optimism (Googie
starbursts, orbit rings, capsule shapes) lives in the brand mark, the capsule buttons,
the cream ground, and the one queue-clear sparkle — never in the clinical surfaces.
Severity colors, contrast ratios, and the audit's visual language are untouched; a
tool that is part of a legal record earns trust by staying calm, and earns love by
being warm at the edges.

The molar follows the practice's own mascot guardrails (`docs/characters.md`): squat and
wide, rounded cusps, two stubby root-feet, deliberately non-phallic, G-rated.

| File | Use |
|---|---|
| `smile-notes-mark.svg` | Full-color logomark: app tile, favicon, avatars, social |
| `smile-notes-mark-mono.svg` | Single-color variant (`currentColor`): print, engraving, dark surfaces |
| `smile-notes-lockup.svg` | Horizontal lockup with wordmark + tagline: letterhead, splash, marketing |

## Palette

Live tokens: `src/lib/theme/palette.ts` + `tailwind.config.ts` (**Daylight chart**,
2026-08-08). Work surfaces use warm paper + navy/blue/check-teal. Coral/gold stay
at brand edges (mark orbit, queue-clear sparkle) — not as page chrome.

| Color | Hex | Token | Role |
|---|---|---|---|
| Warm paper | `#F3F1EB` | `brand-cream` | App ground (cooler Daylight paper — less yellow fog under LEDs) |
| Space navy | `#1E3A5F` | `brand-navy` | Wordmark ink, headings, Submit top |
| Note blue | `#2B6CB8` | `brand-blue` | Primary interactive / focus / Submit bottom |
| Check teal | `#0F766E` | `brand-teal` | Copy/complete + eyebrow chrome (WCAG AA on paper) |
| Badge teal | `#5FB3A8` | mark only | Decorative check on the logomark |
| Orbit coral | `#F26D6D` | mark only | Atomic orbit on the logomark |
| Starburst gold | `#F2CE4B` | `brand-gold` | Celebration sparks (queue-clear) |
| White | `#FFFFFF` | — | Cards, molar, badge check |

Tokens live in [`tailwind.config.ts`](../tailwind.config.ts) under `colors.brand`.

The navy/blue/teal family matches the practice character-set blues
(`docs/characters.md`) so brand and mascots read as one family.
## Wordmark

"Smile Notes" set bold with tight tracking; "Notes" carries the brand blue. The lockup
uses a rounded system font stack on screen. **For print or a registration deposit,
convert the text to outlines** in any vector editor (Illustrator, Inkscape: Path →
Object to Path) — the logomark itself is already pure paths and needs no conversion.

## Usage rules

- Clear space: keep one badge-diameter of empty space around the mark. Minimum size 16 px.
- Do not recolor the check badge to red or amber — teal/green is the "cleared" signal
  the app's andon system reserves for a clean queue.
- Do not put a face on the brand molar. Sparkle (the mascot) has the face; the brand
  mark stays calm. A clinical tool earns trust by looking calm and staying out of the way.
- The in-app header renders the mark inline (`src/components/shell/BrandMark.tsx`) so it
  costs no request and cannot 404.

## Copyright filing notes (for the owner — not legal advice)

- The SVG files are the artwork; print each to PDF at high resolution for deposit copies.
- The copyright line in the app footer (`src/lib/brand.ts`) states the publication year;
  keep the filing consistent with it.
- Registration itself (Form VA for visual arts) is your action with the U.S. Copyright
  Office or your counsel; consider a trademark search on "Smile Notes" for the dental
  software class (International Class 9/42) before commercial rollout, since brand names
  are trademark territory rather than copyright.
