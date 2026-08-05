import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  RISK_CATEGORIES,
  RULE_RISK_CATEGORY,
  categoryOf,
  coverageByCategory,
  type RiskCategoryId
} from "./categories";

// A taxonomy nobody is forced to use is a comment with extra steps.
//
// The test below reads the rule sources and fails when a rule id exists that this
// module has not placed. That is the whole point: the failure taxonomy is only
// worth having if "we shipped a rule and never asked what failure it addresses"
// is a build error rather than a thing somebody notices two years later.

const RULES_DIR = path.resolve(__dirname, "../audit/rules");

/**
 * Every rule id the engine can emit, read out of the source.
 *
 * THREE shapes exist, and the first draft of this scanner saw only two — which is
 * worth recording, because the miss was the exact failure this file claims to
 * prevent. The completeness and justification rules keep their ids in a table
 * (`id: "complete.extraction-no-outcome"`) and emit `ruleId: rule.id`, so a scanner
 * looking only for a literal beside the word `ruleId` silently skipped the eight
 * rules with the strongest research behind them and reported full coverage.
 *
 *   1. literal      — `ruleId: "gate.unknown-shorthand"`
 *   2. table entry  — `id: "complete.rx-no-duration"`, emitted as `ruleId: rule.id`
 *   3. template     — `ruleId: \`medsafe.interaction.${ix.id}\``, captured as the
 *                     family `medsafe.interaction.`
 *
 * Shapes 1 and 2 are collected together and filtered to ids containing a dot, which
 * is what distinguishes a rule id from the bare key of a table row (the interaction
 * table's `id: "warfarin-azole"` becomes a rule id only once its family prefixes
 * it, and the family already covers it). A false positive here is harmless — it
 * demands a categorization for something that turns out not to need one, which
 * fails loudly. A false negative is the thing that must never happen, and did.
 */
function declaredRuleIds(): { exact: string[]; families: string[] } {
  const exact = new Set<string>();
  const families = new Set<string>();

  for (const file of readdirSync(RULES_DIR)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const src = readFileSync(path.join(RULES_DIR, file), "utf8");

    for (const m of src.matchAll(/\b(?:ruleId|id):\s*"([^"]+)"/g)) {
      if (m[1].includes(".")) exact.add(m[1]);
    }
    for (const m of src.matchAll(/ruleId:\s*`([^`$]*)\$\{/g)) families.add(m[1]);
  }

  return { exact: [...exact].sort(), families: [...families].sort() };
}

describe("every rule is placed in a failure category", () => {
  const { exact, families } = declaredRuleIds();

  it("finds the rule ids in the source at all", () => {
    // Guards the scanner itself, because an exhaustiveness check that sees nothing
    // passes vacuously and would be worse than no check. Named samples of both
    // shapes rather than a count: a threshold drifts, but "the engine still emits
    // complete.extraction-no-outcome" is a fact this test should know.
    for (const id of [
      "complete.extraction-no-outcome",
      "complete.consent-no-decision",
      "required.missing",
      "anatomy.invalid-tooth",
      "gate.unknown-shorthand"
    ]) {
      expect(exact, `scanner stopped seeing literal rule ids`).toContain(id);
    }
    for (const id of ["phi.ssn", "residue.tbd"]) {
      expect(exact, `scanner stopped seeing table-declared rule ids`).toContain(id);
    }
    for (const family of ["medsafe.interaction.", "abbrev.", "stigma."]) {
      expect(families, `scanner stopped seeing composed rule families`).toContain(family);
    }
  });

  it("places every literal rule id", () => {
    const orphans = exact.filter((id) => categoryOf(id) === null);
    expect(
      orphans,
      `These rules exist but no failure category claims them. Add each to ` +
        `RULE_RISK_CATEGORY in src/lib/risk/categories.ts:\n  ${orphans.join("\n  ")}`
    ).toEqual([]);
  });

  it("places every dynamically composed rule family", () => {
    const orphans = families.filter((prefix) => categoryOf(`${prefix}anything`) === null);
    expect(orphans, `Uncategorized rule families: ${orphans.join(", ")}`).toEqual([]);
  });
});

describe("the taxonomy itself", () => {
  it("keeps the categories distinct and substantive", () => {
    const ids = new Set(RISK_CATEGORIES.map((c) => c.id));
    expect(ids.size).toBe(RISK_CATEGORIES.length);
    for (const c of RISK_CATEGORIES) {
      // Each has to say what the defect looks like AND what a reader loses to it.
      // A category that cannot express the second is a detector, not a failure mode.
      expect(c.defect.length, c.id).toBeGreaterThan(40);
      expect(c.whatAReaderNeeds.length, c.id).toBeGreaterThan(20);
    }
  });

  it("promises nothing about legal outcomes", () => {
    // The framing constraint, enforced. This module is the spine of a language
    // optimizer for risk reduction; it is not entitled to claim a note is
    // defensible, compliant, or safe from a claim, and neither is anything that
    // paraphrases it onto a screen.
    const forbidden = /\b(?:defensib|litigat|lawsuit|malpractice|court|protects? you|compliant|guarantee)/i;
    for (const c of RISK_CATEGORIES) {
      for (const [field, text] of Object.entries({
        label: c.label,
        defect: c.defect,
        whatAReaderNeeds: c.whatAReaderNeeds
      })) {
        expect(forbidden.test(text), `${c.id}.${field} makes a claim this tool cannot keep: ${text}`).toBe(false);
      }
    }
  });

  it("routes an exact id ahead of a family prefix", () => {
    expect(categoryOf("medsafe.interaction.warfarin-azole")).toBe("medication-safety");
    expect(categoryOf("phi.ssn")).toBe("identifier-exposure");
    expect(categoryOf("complete.extraction-no-outcome")).toBe("material-omission");
  });

  it("returns null for a rule it has never heard of", () => {
    expect(categoryOf("nonsense.not-a-rule")).toBeNull();
  });
});

describe("coverage, per failure mode", () => {
  it("reports which categories have rules and which do not", () => {
    const coverage = coverageByCategory();
    expect(coverage.length).toBe(RISK_CATEGORIES.length);

    // The question the detector taxonomy could not answer. Uncovered categories are
    // allowed to exist — they are the backlog — but they must be VISIBLE, and this
    // assertion is what keeps the report honest rather than aspirational.
    const uncovered = coverage.filter((c) => c.rules.length === 0).map((c) => c.category.id);
    const covered = coverage.filter((c) => c.rules.length > 0).map((c) => c.category.id);

    expect(covered.length + uncovered.length).toBe(RISK_CATEGORIES.length);
    // Every category currently claims at least one rule. When a future category is
    // added ahead of the rule that serves it, this flips and the message names it.
    expect(uncovered, `Failure modes with no rule behind them: ${uncovered.join(", ")}`).toEqual([]);
  });

  it("separates material omission from a merely empty field", () => {
    // The concrete regression this taxonomy exists to prevent. Both of these are
    // AuditCategory "required"; only one of them is a documented failure mode with
    // a body of research behind it, and the code can now tell them apart.
    const omission = coverageByCategory().find((c) => c.category.id === "material-omission");
    expect(omission?.rules).toContain("complete.extraction-no-outcome");
    expect(omission?.rules).toContain("complete.consent-no-decision");
  });

  it("assigns every category id used in the map to a real category", () => {
    const known = new Set<RiskCategoryId>(RISK_CATEGORIES.map((c) => c.id));
    for (const id of Object.values(RULE_RISK_CATEGORY)) expect(known.has(id)).toBe(true);
  });
});
