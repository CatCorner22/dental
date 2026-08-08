// SEMANTIC DESIGN TOKENS for Smile Notes.
//
// Architecture: primitive (palette.ts / tailwind.config.ts) → semantic (here)
// → component CSS (.btn-primary, .btn-complete, .fast-lane-card).
//
// Primitives stay Daylight-branded (cream paper, navy ink, blue interactive,
// check teal). This file does NOT invent a second palette — it names roles so
// Fast Lane / handoff UI can speak intent without hardcoding hex in feature code.
//
// Severity (rose/amber/green for audit state) is deliberately NOT here: it
// lives in audit/types and must stay one source of truth.
//
// Keep in step with design-tokens.json and docs/design-tokens.md.

import { BRAND, SLATE, WHITE } from "./palette";

/** Page and surface roles. */
export const SURFACE = {
  /** Page ground (brand cream). */
  page: BRAND.cream,
  /** Elevated content card. */
  card: WHITE,
  /** Nested / inset surface. */
  inset: BRAND.cream,
  /** Soft wash behind Fast Lane cards. */
  soft: SLATE[50]
} as const;

/** Text roles on light surfaces. */
export const FG = {
  /** Headings / brand ink. */
  brand: BRAND.navy,
  /** Body on white. */
  body: SLATE[800],
  /** Secondary / help. */
  muted: SLATE[500],
  /** Quiet captions. */
  subtle: SLATE[400],
  /** Eyebrow / quiet chrome. */
  chrome: BRAND.teal
} as const;

/**
 * Action roles.
 *
 * primary  — legal / filing path (Submit). Gradient navy→blue in CSS.
 * complete — handoff path (Copy for Curve / EDR). Solid teal; distinct so
 *            writers do not confuse filing with clipboard handoff.
 * soft     — secondary chrome (chips, Fast Lane cards).
 */
export const ACTION = {
  primary: BRAND.navy,
  primaryInteractive: BRAND.blue,
  primaryOn: WHITE,
  complete: BRAND.teal,
  completeOn: WHITE,
  completeSoft: "rgba(15, 118, 110, 0.08)",
  soft: SLATE[100],
  softOn: SLATE[700]
} as const;

export const BORDER = {
  default: SLATE[200],
  strong: SLATE[300],
  field: SLATE[500],
  focus: BRAND.blue
} as const;

/** Touch / spacing hints used by Fast Lane (4px base scale). */
export const SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32
} as const;

export const TARGET = {
  /** Minimum tap target (WCAG / Apple HIG). */
  minPx: 44
} as const;
