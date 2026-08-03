import { describe, expect, it } from "vitest";
import {
  isWishCategory,
  isWishStatus,
  ruleDisagreementStats,
  sortWishes,
  WISH_CATEGORIES,
  WISH_TITLE_MAX,
  wishError
} from "./wishes";

describe("the bar is deliberately at the floor", () => {
  // The Gauntlet is hard on purpose. This is the opposite trade: the cost of a
  // bad suggestion is that someone reads a sentence, and the cost of a
  // suppressed safety observation lands on a patient.
  it("accepts a short, plain report", () => {
    expect(wishError({ category: "supply", title: "gloves keep running out", detail: "" })).toBeNull();
  });

  it("accepts a two-word supply request", () => {
    expect(wishError({ category: "supply", title: "small gloves", detail: "" })).toBeNull();
  });

  it("asks for no justification, no checklist, no length", () => {
    // A one-line standards report with no detail at all must go through.
    expect(
      wishError({ category: "standards", title: "autoclave printout missing", detail: "" })
    ).toBeNull();
  });
});

describe("what it does reject", () => {
  it("needs a category", () => {
    expect(wishError({ category: "nope", title: "a real thing", detail: "" })).toContain("category");
    expect(wishError({ category: undefined, title: "a real thing", detail: "" })).toContain("category");
  });

  it("needs actual words, not a single character", () => {
    expect(wishError({ category: "other", title: "x", detail: "" })).toBeTruthy();
    expect(wishError({ category: "other", title: "", detail: "" })).toBeTruthy();
    expect(wishError({ category: "other", title: "   ", detail: "" })).toBeTruthy();
  });

  it("caps the one-liner and the detail", () => {
    expect(
      wishError({ category: "other", title: "gloves ".repeat(40), detail: "" })
    ).toContain("under");
    expect(wishError({ category: "other", title: "a real thing", detail: "x".repeat(5000) })).toContain(
      "over"
    );
  });
});

describe("categories and statuses", () => {
  it("puts the safety category first and marks it urgent", () => {
    expect(WISH_CATEGORIES[0].id).toBe("standards");
    expect(WISH_CATEGORIES[0].urgent).toBe(true);
  });

  it("validates category and status values", () => {
    expect(isWishCategory("standards")).toBe(true);
    expect(isWishCategory("../../etc/passwd")).toBe(false);
    expect(isWishStatus("declined")).toBe(true);
    expect(isWishStatus("deleted")).toBe(false);
  });

  it("gives every category a hint that lowers the barrier", () => {
    for (const c of WISH_CATEGORIES) expect(c.hint.length).toBeGreaterThan(20);
  });
});

describe("sorting keeps safety visible", () => {
  const at = (d: string) => new Date(d);
  const rows = [
    { id: 1, category: "feature", status: "new", createdAt: at("2026-08-02") },
    { id: 2, category: "standards", status: "new", createdAt: at("2026-07-01") }, // OLD
    { id: 3, category: "supply", status: "new", createdAt: at("2026-08-03") },
    { id: 4, category: "standards", status: "done", createdAt: at("2026-08-03") } // settled
  ];

  it("floats an OPEN standards report above everything, however old", () => {
    // The whole point: a safety observation must not be pushed off the bottom
    // of the page by a pile of newer feature ideas.
    expect(sortWishes(rows)[0].id).toBe(2);
  });

  it("does not float a standards report that has been dealt with", () => {
    const order = sortWishes(rows).map((r) => r.id);
    expect(order.indexOf(4)).toBeGreaterThan(0);
  });

  it("orders the rest newest first", () => {
    const rest = sortWishes(rows).slice(1).map((r) => r.id);
    expect(rest).toEqual([3, 4, 1]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortWishes(rows);
    expect(rows).toEqual(copy);
  });
});


// The two defects that made the safety half of this feature untrustworthy.
//
// Both are about the same thing: a below-standard report is the one item on
// this list where the record IS the point, and both bugs let one disappear
// quietly — one by volume, one by a silent close.
describe("a below-standard report cannot be buried or closed silently", () => {
  it("sorts an OLD open standards report above newer everything", () => {
    // sortWishes did this correctly all along. The bug was upstream: the page
    // applied a 500-row LIMIT first, so an old report fell out of the query
    // before this function ever saw it — and the amber banner, counted from
    // the same truncated list, dropped to zero with it. Fixed by fetching open
    // standards reports separately and unbounded; this pins the ranking half.
    const old = {
      category: "standards",
      status: "new",
      createdAt: new Date(2020, 0, 1)
    };
    const newer = Array.from({ length: 50 }, (_, i) => ({
      category: "feature",
      status: "new",
      createdAt: new Date(2026, 0, i + 1)
    }));
    const sorted = sortWishes([...newer, old]);
    expect(sorted[0]).toBe(old);
  });

  it("stops floating one once it is genuinely settled", () => {
    const done = { category: "standards", status: "done", createdAt: new Date(2020, 0, 1) };
    const open = { category: "feature", status: "new", createdAt: new Date(2026, 0, 1) };
    expect(sortWishes([done, open])[0]).toBe(open);
  });
});

describe("ruleDisagreementStats", () => {
  const row = (title: string, status = "new", category = "rule-disagreement") => ({
    category,
    status,
    title
  });

  it("groups by rule, counts open vs settled, sorts by open first", () => {
    const stats = ruleDisagreementStats([
      row("Rule disagreement: vague.tolerated-well"),
      row("Rule disagreement: vague.tolerated-well", "looking"),
      row("Rule disagreement: vague.tolerated-well", "declined"),
      row("Rule disagreement: medsafe.interaction.nsaid-asthma"),
      row("Unrelated wish", "new", "feature")
    ]);
    expect(stats).toEqual([
      { rule: "vague.tolerated-well", open: 2, settled: 1 },
      { rule: "medsafe.interaction.nsaid-asthma", open: 1, settled: 0 }
    ]);
  });

  it("returns empty for no disagreements", () => {
    expect(ruleDisagreementStats([row("x", "new", "feature")])).toEqual([]);
  });
});
