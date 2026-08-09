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
//
// Daylight chart (2026-08-08 market stakeholder panels): warm paper ground,
// space navy ink, note blue interactive, check-teal complete — not lilac /
// AI-purple SaaS chrome. See knowledge/sources/market-ux-stakeholder-panels.md.
//
// Severity fills (2026-08-09 color-theory digest): luminance ladder + violet
// Style + bluish-green clear — hue is never the only channel (shapes/words
// still required). See knowledge/sources/color-theory-uiux.md.

/** Brand chrome. Daylight clinical instrument — navy / blue / teal on paper. */
export const BRAND = {
  /**
   * Page ground — cooler Daylight paper (less yellow fog under operatory LEDs)
   * while keeping enough luminance gap from white cards.
   */
  cream: "#F3F1EB",
  /** Ink: headings, the active nav pill, the top stop of the primary button. */
  navy: "#1E3A5F",
  /** Interactive: links, the bottom stop of the primary button, focus. */
  blue: "#2B6CB8",
  /**
   * Quiet chrome + Copy/complete surface. Darker than the mark's decorative
   * check badge (`#5FB3A8`) so white labels and eyebrow text clear WCAG AA.
   */
  teal: "#0F766E",
  /** The one surviving warm accent — the celebration star. */
  gold: "#F2CE4B"
} as const;

/**
 * Audit / Andon severity fills — third channel beside shape + word.
 *
 * Chip fills for S0→S1→S2 are monotonic in relative luminance so grayscale
 * (and deuteranopia) still ranks urgency. Style is violet (not brand blue).
 * Clear is bluish emerald (Okabe-style separation from vermillion Stop).
 */
export const SEVERITY_COLOR = {
  stop: {
    fill: "#9B1C1C",
    soft: "#FEF2F2",
    ink: "#7F1D1D",
    rail: "#B91C1C",
    onFill: "#FFFFFF"
  },
  required: {
    fill: "#C2410C",
    soft: "#FFF7ED",
    ink: "#9A3412",
    rail: "#EA580C",
    onFill: "#FFFFFF"
  },
  review: {
    fill: "#D97706",
    soft: "#FFFBEB",
    ink: "#1C1917",
    rail: "#D97706",
    onFill: "#1C1917"
  },
  style: {
    fill: "#6D28D9",
    soft: "#F5F3FF",
    ink: "#5B21B6",
    rail: "#7C3AED",
    onFill: "#FFFFFF"
  },
  info: {
    fill: "#475569",
    soft: "#F8FAFC",
    ink: "#334155",
    rail: "#64748B",
    onFill: "#FFFFFF"
  },
  /** Audit-clear / Ready — not brand Copy-teal, not lime-on-red traffic green. */
  clear: {
    fill: "#047857",
    soft: "#ECFDF5",
    ink: "#065F46",
    rail: "#059669",
    onFill: "#FFFFFF"
  }
} as const;

/**
 * The neutral ramp — cool blue-gray (operatory daylight), not purple-tinted.
 *
 * This overrides Tailwind's own `slate`, which repaints roughly 676 utilities
 * across the app without editing a single component — and, just as importantly,
 * keeps the CLASS NAMES intact. The high-contrast rules in globals.css select on
 * `.text-slate-500` and `.border-slate-200` literally, so renaming the utility
 * would silently switch high-contrast mode off for the people who need it.
 *
 * slate-500 is darkened vs stock Tailwind so captions clear 4.5:1 on cream.
 */
export const SLATE = {
  50: "#F8FAFC",
  100: "#F1F5F9",
  200: "#E2E8F0",
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#5B6578",
  600: "#475569",
  700: "#334155",
  800: "#1E293B",
  900: "#0F172A"
} as const;

/** The two hexes the high-contrast block in globals.css must mirror. */
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
  const L = Math.max(la, lb);
  const l = Math.min(la, lb);
  return (L + 0.05) / (l + 0.05);
}
