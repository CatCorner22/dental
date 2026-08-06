// THE PALETTE, as data.
//
// The colours themselves live in tailwind.config.ts, because that is what
// Tailwind reads. This file is the same values expressed as plain data so a
// test can check them — vitest runs `environment: "node"` over `src/**/*.test.ts`
// only, so a `.tsx` render test is not available and a stylesheet cannot be
// asserted directly. Restating the ramp here and checking the ratios is the one
// way a contrast regression fails CI instead of shipping.
//
// Keep this file and tailwind.config.ts in step. contrast.test.ts is what
// notices when they drift apart, because it asserts the RELATIONSHIPS
// (heading on ground, white on button, border on card) rather than the hexes.

/** Brand chrome. Purple ink and purple interactive, on a light-purple ground. */
export const BRAND = {
  /** Page ground. Deliberately not lighter — see the note in tailwind.config.ts. */
  cream: "#EDE9F6",
  /** Ink: headings, the active nav pill, the top stop of the primary button. */
  navy: "#3B2B66",
  /** Interactive: links, the bottom stop of the primary button, focus. */
  blue: "#6D4AC4",
  /** Quiet chrome: the eyebrow, the .card-note rail. Never state. */
  teal: "#5B4A8F",
  /** The one surviving warm accent — the celebration star. */
  gold: "#F2CE4B"
} as const;

/**
 * The neutral ramp, tinted purple rather than blue.
 *
 * This overrides Tailwind's own `slate`, which repaints roughly 676 utilities
 * across the app without editing a single component — and, just as importantly,
 * keeps the CLASS NAMES intact. The high-contrast rules in globals.css select on
 * `.text-slate-500` and `.border-slate-200` literally, so renaming the utility
 * would silently switch high-contrast mode off for the people who need it.
 */
export const SLATE = {
  50: "#F8F7FB",
  100: "#F1EFF6",
  200: "#E4E1EC",
  300: "#CFCADB",
  400: "#9C93B3",
  500: "#6E6685",
  600: "#565070",
  700: "#433E58",
  800: "#322E44",
  900: "#23202F"
} as const;

/** The two hexes the high-contrast block in globals.css hardcodes. */
export const HIGH_CONTRAST = {
  /** Replaces text-slate-400/500/600 when [data-contrast="high"]. */
  text: SLATE[700],
  /** Replaces border-slate-100/200/300, the card ring, and placeholders. */
  border: SLATE[600]
} as const;

export const WHITE = "#FFFFFF";

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, 1–21. Order of the arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
