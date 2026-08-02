# Dental Mascot Character Set

Nine G-rated, child-friendly dental mascots for the practice. Source-of-truth vector art lives
in [`public/characters/`](../public/characters/) as hand-built SVGs — **infinitely scalable**
(favicon → billboard) with **inherently transparent backgrounds**. Open
[`public/characters/preview.html`](../public/characters/preview.html) (served at
`/characters/preview.html`) to see every character on light/dark checkerboards plus a
scalability strip.

## Roster & balance

| # | Character | Role | Gender presentation | File |
|---|-----------|------|--------------------|------|
| 1 | **Jayla** the Blue Jay | Dental hygienist (pink scrubs, brush + mirror) | Female | `01-jayla-bluejay-hygienist.svg` |
| 2 | **Doc Otto** the Otter | Dentist (lab coat, glasses, Tennessee cap) | Male | `02-doc-otto-otter-dentist.svg` |
| 3 | **Benny** the Black Bear | Dental assistant (blue scrubs, tool tray) | Male | `03-benny-bear-assistant.svg` |
| 4 | **Sparkle** the Tooth | Mascot tooth (rainbow scarf + rainbow toothbrush) | Gender-neutral · **Rainbow-themed** | `04-sparkle-rainbow-tooth.svg` |
| 5 | **Nova** the Astro-Dino | Astronaut (dome helmet, glowing toothbrush) | Gender-neutral | `05-nova-astro-dino.svg` |
| 6 | **Callie** the Calico Cat | Dental staff (pink/white scrubs, floss + mirror) | Female | `06-callie-calico-cat.svg` |
| 7 | **Biscuit** the Retriever Puppy | Brushing buddy (bandana, big foamy brush) | Gender-neutral | `07-biscuit-retriever-puppy.svg` |
| 8 | **Olive** the Barn Owl | Office professional (teal scrubs, glasses, smile chart) | Female | `08-olive-barn-owl-professional.svg` |
| 9 | **Dr. Bo** the Bobcat | Specialist (lab coat, stethoscope) | Male | `09-dr-bo-bobcat-labcoat.svg` |

Balance: **3 female / 3 male / 3 gender-neutral**, with #4 as the rainbow-themed character.
Gender is expressed only through soft, conventional styling cues (lashes/bows vs. brows;
neutral characters get symmetric round features and no gendered cues).

## Content guardrails (apply to every future variant)

- **G-rated only** — no innuendo, no scary teeth/fangs beyond tiny friendly points, no needles/drills as focal props.
- **Tooth characters must be non-phallic** — squat and wide (crown wider than tall where possible), rounded cusps, two short stubby root-feet; never elongated single-root shapes.
- Professional theming: real dental props (mouth mirror, scaler, floss, chart, tray), correct PPE vibes, no gore/blood.
- Diverse and inclusive; keep the 3/3/3 gender split and at least one rainbow-themed character in any expanded set.

## Shared style system (for new characters)

- Canvas `viewBox="0 0 512 512"`, subject centered, soft ground-shadow ellipse (`opacity ≈ 0.08`).
- Rounded, plump forms; big glossy eyes (dark iris + 2 white highlights), blush ellipses at ~55% opacity.
- Pastel palette anchors: pinks `#F6BBD0/#EE9BBB`, blues `#9EC7E8/#6FA8DC`, teal `#5FB3A8`,
  cream `#F7E8C8`, rainbow set `#F26D6D #F9A758 #F2CE4B #7FC97F #6FA8DC #9B7FD4`.
- No external fonts/images/CSS — every file is fully self-contained (safe for `<img>`, inline, or mask use).
- Include `role="img"` + `aria-label` on the root `<svg>`.

## Usage in the app

```tsx
import Image from "next/image";
<Image src="/characters/04-sparkle-rainbow-tooth.svg" alt="Sparkle the Tooth" width={160} height={160} />
```

They also work as CSS backgrounds, favicons (`<link rel="icon" href="/characters/04-sparkle-rainbow-tooth.svg">`),
and print at any size.

## Painted-style prompt pack

The SVGs are the scalable production set. If you also want the soft painted look of the
original concept samples, use these prompts in your image generator (Midjourney/DALL·E/etc.).

**Shared style block — append to every prompt:**

> cute children's-book mascot illustration, soft painterly rendering, pastel palette, big
> friendly glossy eyes, rosy blush, standing full-body facing viewer, professional dental
> theming, G-rated and child-friendly, isolated character on plain solid background for
> easy cutout, no text artifacts, high detail fur/feather texture

**Negative prompt:** scary, realistic gore, needles, sharp menacing teeth, adult themes, watermark, extra limbs.

1. **Jayla (F, blue jay hygienist):** adorable female blue jay bird with blue crest, white face and black necklace marking, long eyelashes, wearing pink v-neck scrub top with tooth pocket, holding a pink toothbrush in one wing and a dental mouth mirror in the other, surgical mask pulled down under chin.
2. **Doc Otto (M, otter dentist):** friendly male river otter dentist with round gold glasses, tan baseball cap reading "TENNESSEE", white lab coat over light-blue shirt and navy tie, "TN" on chest pocket, holding a dental scaler and mouth mirror, thick otter tail, brown boots.
3. **Benny (M, black bear assistant):** gentle male black bear in light-blue scrubs, white name badge reading "BENNY — DENTAL ASSISTANT" with a small pink heart, holding a light-blue tray of dental instruments with both paws, tan muzzle, warm smile.
4. **Sparkle (N, rainbow tooth):** cheerful gender-neutral tooth mascot, squat wide rounded molar shape with two stubby rounded root-feet (deliberately non-phallic), wearing a knotted rainbow scarf, holding a rainbow-striped toothbrush, soft rainbow arc and golden sparkles behind, simple stub arms, rosy cheeks.
5. **Nova (N, astronaut dinosaur):** happy gender-neutral mint-green dinosaur astronaut with cream back-plates, clear glass dome helmet with antenna, white space suit with chest control panel and circular tooth mission patch, orange utility belt, holding a glowing blue toothbrush, tiny stars around.
6. **Callie (F, calico cat):** sweet female calico cat with orange and black patches on white fur, huge sparkly eyes with lashes, pink-trimmed white scrub top reading "DENTAL STAFF" with heart pocket and waist bow, holding a pink jar labeled "DENTAL FLOSS — MINTY FRESH" and a pink mouth mirror.
7. **Biscuit (N, golden retriever puppy):** joyful gender-neutral golden retriever puppy, floppy ears, tongue out, blue bandana with white tooth emblem, light-blue tee, hugging an oversized lavender toothbrush with foamy bubbles on the bristles with both paws.
8. **Olive (F, barn owl professional):** wise female barn owl office professional with heart-shaped white facial disc, tawny speckled feathers, round gold glasses and subtle lashes, teal scrub top with yellow lanyard and ID badge, holding a wooden clipboard showing a "SMILE CHART" of teeth with green checkmarks, pen in the other wing.
9. **Dr. Bo (M, bobcat specialist):** confident male bobcat specialist with black ear tufts, striped cheek ruffs, spotted tawny fur, short bobbed black-tipped tail, white lab coat over teal scrubs, teal stethoscope around neck, holding a dental mouth mirror, thick friendly brows.

For transparent output from raster generators, request PNG with alpha or run the result
through a background remover; the SVGs here need no such step.
