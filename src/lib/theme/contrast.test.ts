import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

import {
  BRAND,
  contrastRatio,
  HIGH_CONTRAST,
  luminance,
  SEVERITY_COLOR,
  SLATE,
  WHITE
} from "./palette";

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

  it("keeps high-contrast CSS hexes in lockstep with HIGH_CONTRAST tokens", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(`color: ${HIGH_CONTRAST.text} !important`);
    expect(css).toContain(`border-color: ${HIGH_CONTRAST.border} !important`);
    // Placeholder uses the border token (same slate-600 ink).
    expect(css.match(new RegExp(HIGH_CONTRAST.border, "g"))?.length ?? 0).toBeGreaterThanOrEqual(2);
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

describe("severity luminance ladder (CVD / grayscale rank)", () => {
  it("ranks Stop < Required < Review by chip-fill luminance", () => {
    // Adjacent warm hues collapse under deuteranopia; lightness must still climb.
    const stop = luminance(SEVERITY_COLOR.stop.fill);
    const required = luminance(SEVERITY_COLOR.required.fill);
    const review = luminance(SEVERITY_COLOR.review.fill);
    expect(required).toBeGreaterThan(stop);
    expect(review).toBeGreaterThan(required);
  });

  it("keeps chip label ink AA against every severity fill", () => {
    for (const [name, swatch] of Object.entries(SEVERITY_COLOR)) {
      expect(
        contrastRatio(swatch.onFill, swatch.fill),
        `${name} onFill vs fill`
      ).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it("keeps soft-panel ink AA on soft fills and on white", () => {
    for (const [name, swatch] of Object.entries(SEVERITY_COLOR)) {
      expect(contrastRatio(swatch.ink, swatch.soft), `${name} ink on soft`).toBeGreaterThanOrEqual(
        TEXT
      );
      expect(contrastRatio(swatch.ink, WHITE), `${name} ink on white`).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it("keeps Style violet distinct from brand interactive blue (hex)", () => {
    expect(SEVERITY_COLOR.style.fill.toLowerCase()).not.toBe(BRAND.blue.toLowerCase());
    expect(SEVERITY_COLOR.style.rail.toLowerCase()).not.toBe(BRAND.blue.toLowerCase());
  });

  it("keeps Ready/clear bluish-green distinct from Stop vermillion", () => {
    expect(SEVERITY_COLOR.clear.fill.toLowerCase()).not.toBe(SEVERITY_COLOR.stop.fill.toLowerCase());
    // Clear should be lighter than Stop so grayscale still separates Ready from Blocked.
    expect(luminance(SEVERITY_COLOR.clear.fill)).toBeGreaterThan(
      luminance(SEVERITY_COLOR.stop.fill)
    );
  });
});

// SLATE-400 IS NOT A TEXT COLOUR, AND THE APP ALREADY KNEW IT.
//
// globals.css carries a note, inside the `[data-contrast="high"]` block, saying
// slate-400 on white is below the 4.5:1 normal text needs and that this "is what
// help text and timestamps were rendered in". The overriding rule was then
// scoped to high-contrast mode only — so the app diagnosed its own caption
// colour correctly and fixed it exclusively for people who go and find a
// setting. Everybody else got it at 2.4:1, measured across forty places on a
// running build: Byte's citations, the enrollment prompts, the footer, the
// per-100-words rails, the "(optional)" markers.
//
// slate-400 is fine for a chevron or a rule. The moment it carries a word it is
// unreadable, so the guard is on the class in the markup rather than on the hex.
describe("slate-400 stays out of running text", () => {
  it("fails the normal-text threshold, which is why the rule below exists", () => {
    expect(contrastRatio(SLATE[400], WHITE)).toBeLessThan(TEXT);
    expect(contrastRatio(SLATE[500], WHITE)).toBeGreaterThanOrEqual(TEXT);
  });

  it("holds up as caption text on the ground too, where it is closest to the line", () => {
    // slate-500 is now every caption in the app, and on the Daylight cream
    // ground it must clear 4.5. This is the assertion that makes a lightened
    // ground or lightened ramp loud before forty captions go under silently.
    expect(contrastRatio(SLATE[500], GROUND)).toBeGreaterThanOrEqual(TEXT);
  });

  it("appears only on elements hidden from the accessibility tree", () => {
    const files = globSync("src/**/*.tsx", { cwd: process.cwd() });
    const offenders: string[] = [];
    for (const rel of files) {
      const source = readFileSync(rel, "utf8");
      source.split("\n").forEach((line, i) => {
        if (!line.includes("text-slate-400")) return;
        // Decorative by declaration. A screen reader never reaches it, and a
        // sighted reader is not being asked to read words.
        if (/aria-hidden/.test(line)) return;
        offenders.push(`${rel}:${i + 1} ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
