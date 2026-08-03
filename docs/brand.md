# Smile Notes brand assets

Original works, hand-authored as SVG vector paths in [`public/brand/`](../public/brand/).
No stock art, no third-party elements, no AI-generated raster imagery — the marks are
human-reviewable vector source, which is the form you want for a copyright deposit.

## The mark

**Concept: "the note that checks itself."** A note card (writing rules at the top-left)
holds a squat, friendly molar with a smile on its crown; a teal verification badge
overlays the corner. It compresses the whole product into one image: a clinical note,
kept friendly, that does not leave the tool until it has been checked.

The molar follows the practice's own mascot guardrails (`docs/characters.md`): squat and
wide, rounded cusps, two stubby root-feet, deliberately non-phallic, G-rated.

| File | Use |
|---|---|
| `smile-notes-mark.svg` | Full-color logomark: app tile, favicon, avatars, social |
| `smile-notes-mark-mono.svg` | Single-color variant (`currentColor`): print, engraving, dark surfaces |
| `smile-notes-lockup.svg` | Horizontal lockup with wordmark + tagline: letterhead, splash, marketing |

## Palette

| Color | Hex | Role |
|---|---|---|
| Note blue | `#2B6CB8` | Primary brand color, card ground |
| Check teal | `#5FB3A8` | Verification accent — the color of "cleared" |
| Ink slate | `#1F2937` | Wordmark text |
| White | `#FFFFFF` | Molar, badge check |

The blues and teal are drawn from the existing character-set palette
(`docs/characters.md`), so the brand and the mascots read as one family.

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
