import { describe, expect, it } from "vitest";
import { runTextAudit } from "./engine";

// The audit runs on every keystroke in the browser and on up to 200,000
// characters in the email route. No pattern may degrade superlinearly.
describe("audit performance", () => {
  const budgetMs = 1000;

  it.each([
    ["digit-and-dash run", "123-45-".repeat(10_000) + "6789"],
    ["hyphenated word run", "a-".repeat(30_000)],
    ["max-payload word run", "a-".repeat(100_000)],
    ["unclosed placeholders", "<".repeat(20_000) + ">".repeat(20_000)],
    ["repeated honorifics", "Dr. ".repeat(10_000) + "Smith"],
    ["long prose", "The clinician observed generalized plaque. ".repeat(500)]
  ])("stays under budget on %s", (_label, input) => {
    const start = performance.now();
    runTextAudit(input);
    expect(performance.now() - start).toBeLessThan(budgetMs);
  });

  it("still detects email addresses after the bounded-quantifier fix", () => {
    for (const text of [
      "write to a@b.com",
      "jane.doe+tag@sub.example.org",
      "x@y.z",
      "user_name@clinic-office.co.uk"
    ]) {
      expect(runTextAudit(text).some((f) => f.ruleId === "phi.email"), text).toBe(true);
    }
    for (const text of ["bad@", "@bad.com", "no address here"]) {
      expect(runTextAudit(text).some((f) => f.ruleId === "phi.email"), text).toBe(false);
    }
  });
});
