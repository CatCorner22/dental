import { describe, expect, it } from "vitest";

import { BRAND, contrastRatio, HIGH_CONTRAST, SLATE, WHITE } from "./palette";

// WCAG 2.x thresholds. 4.5 for normal text, 3.0 for large text and for the
// boundary of a user-interface component (1.4.11) — which is what the
// .field-input border is, and why globals.css sets it to slate-500 rather than
// the decorative slate-300 it used to be.
const TEXT = 4.5;
const UI = 3.0;

const GROUND = BRAND.cream;

describe("palette contrast", () => {
  it("puts headings well clear of both the card and the page", () => {
    // .page-title / .section-title are text-brand-navy, and they appear both on
    // white cards and directly on the ground.
    expect(contrastRatio(BRAND.navy, WHITE)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(BRAND.navy, GROUND)).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps white legible at BOTH stops of the primary button gradient", () => {
    // .btn-primary is `bg-gradient-to-b from-brand-navy to-blue-700`, so white
    // label text sits on brand.navy at the top and brand.blue at the bottom.
    // Checking only one stop is how a gradient button ships half-unreadable.
    expect(contrastRatio(WHITE, BRAND.navy)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(WHITE, BRAND.blue)).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps the eyebrow readable despite being small tracked caps", () => {
    // .eyebrow is text-[0.7rem] — small enough that it needs the normal-text
    // threshold, not the large-text one.
    expect(contrastRatio(BRAND.teal, WHITE)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(BRAND.teal, GROUND)).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps the field border an affordance rather than decoration", () => {
    // .field-input uses border-slate-500. On a white card and on a .card-inset
    // (which is tinted with the ground) it must still read as an edge.
    expect(contrastRatio(SLATE[500], WHITE)).toBeGreaterThanOrEqual(UI);
    expect(contrastRatio(SLATE[500], GROUND)).toBeGreaterThanOrEqual(UI);
  });

  it("keeps the focus ring visible on every surface it can land on", () => {
    expect(contrastRatio(BRAND.blue, WHITE)).toBeGreaterThanOrEqual(UI);
    expect(contrastRatio(BRAND.blue, GROUND)).toBeGreaterThanOrEqual(UI);
  });

  it("keeps body and secondary text above the text threshold", () => {
    expect(contrastRatio(SLATE[900], GROUND)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(SLATE[800], WHITE)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(SLATE[700], WHITE)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(SLATE[600], WHITE)).toBeGreaterThanOrEqual(TEXT);
  });

  it("raises the two hexes high contrast substitutes in", () => {
    // globals.css swaps text-slate-400/500/600 for HIGH_CONTRAST.text and the
    // slate borders for HIGH_CONTRAST.border. Both must beat what they replace.
    expect(contrastRatio(HIGH_CONTRAST.text, WHITE)).toBeGreaterThan(
      contrastRatio(SLATE[400], WHITE)
    );
    expect(contrastRatio(HIGH_CONTRAST.text, WHITE)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HIGH_CONTRAST.border, WHITE)).toBeGreaterThanOrEqual(UI);
  });

  it("orders the neutral ramp monotonically against white", () => {
    // A ramp that is not monotonic makes `text-slate-600` darker than
    // `text-slate-700` somewhere, and every "use one step darker" fix stops
    // working. Cheap to assert, expensive to discover by eye.
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    for (let i = 1; i < steps.length; i += 1) {
      const prev = contrastRatio(SLATE[steps[i - 1]], WHITE);
      const next = contrastRatio(SLATE[steps[i]], WHITE);
      expect(next, `slate-${steps[i]} vs slate-${steps[i - 1]}`).toBeGreaterThan(prev);
    }
  });
});
