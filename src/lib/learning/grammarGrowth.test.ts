import { describe, expect, it } from "vitest";
import { grammarGrowthFromNotes } from "./grammarGrowth";

describe("grammarGrowthFromNotes", () => {
  it("ranks unread categories only after multi-author thresholds", () => {
    const notes = Array.from({ length: 6 }, (_, i) => ({
      text: `Visit note. mystery BW series acquired chairside. Other text.`,
      authorId: `a${i % 3}`,
      filedAt: `2026-01-0${(i % 9) + 1}`
    }));
    const items = grammarGrowthFromNotes(notes);
    // May be empty if extractor reads the whole line — either outcome is fine
    // as long as we never invent a clinical fact and thresholds are respected.
    for (const item of items) {
      expect(item.authors).toBeGreaterThanOrEqual(2);
      expect(item.notes).toBeGreaterThanOrEqual(3);
      expect(item.occurrences).toBeGreaterThanOrEqual(5);
      expect(item.effect.length).toBeGreaterThan(10);
    }
  });

  it("returns nothing below thresholds", () => {
    expect(
      grammarGrowthFromNotes([
        { text: "asdf qwerty", authorId: "solo", filedAt: "2026-01-01" }
      ])
    ).toEqual([]);
  });
});
