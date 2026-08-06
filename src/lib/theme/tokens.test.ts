import { describe, expect, it } from "vitest";
import { contrastRatio, WHITE } from "./palette";
import { ACTION, FG, SURFACE } from "./tokens";

const TEXT = 4.5;

describe("semantic tokens", () => {
  it("maps complete action to a surface that holds white labels", () => {
    // .btn-complete is white text on action.complete (brand teal).
    expect(contrastRatio(ACTION.completeOn, ACTION.complete)).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps brand headings readable on page and card", () => {
    expect(contrastRatio(FG.brand, SURFACE.page)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(FG.brand, SURFACE.card)).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps primary interactive stops usable for white labels", () => {
    expect(contrastRatio(WHITE, ACTION.primary)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(WHITE, ACTION.primaryInteractive)).toBeGreaterThanOrEqual(TEXT);
  });
});
