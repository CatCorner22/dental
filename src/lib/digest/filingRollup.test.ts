import { describe, expect, it } from "vitest";

import type { AuditFinding, AuditReport } from "@/lib/audit/types";
import {
  buildFilingRollupSnapshot,
  buildPracticeFilingRollup,
  parseFilingRollupSnapshot,
  parseModuleIdsFromFrozenAudit,
  parseSeverityCountsFromFrozenAudit
} from "./filingRollup";

function finding(over: Partial<AuditFinding>): AuditFinding {
  return {
    ruleId: "required.missing",
    category: "required",
    severity: "S1",
    message: "Missing",
    ...over
  };
}

function report(findings: AuditFinding[]): AuditReport {
  const counts = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return {
    findings,
    counts,
    status: "NEEDS CLINICIAN ACTION",
    phiStops: findings.filter((f) => f.category === "phi" && f.severity === "S0")
  };
}

describe("buildFilingRollupSnapshot", () => {
  it("stamps modules, categories, killers, and severity counts — no prose", () => {
    const snap = buildFilingRollupSnapshot(
      report([
        finding({
          ruleId: "complete.anesthetic-no-amount",
          category: "required",
          severity: "S2",
          message: "Amount missing"
        }),
        finding({
          ruleId: "anatomy.invalid-tooth",
          category: "anatomy",
          severity: "S0",
          message: "Bad tooth"
        }),
        finding({
          ruleId: "required.missing",
          category: "required",
          severity: "S1",
          message: "Field"
        })
      ]),
      ["universal-core", "direct-restorative", "direct-restorative"]
    );
    expect(snap.v).toBe(1);
    expect(snap.moduleIds).toEqual(["direct-restorative", "universal-core"]);
    expect(snap.categories).toEqual({ required: 2, anatomy: 1 });
    expect(snap.killerRuleIds).toEqual([
      "anatomy.invalid-tooth",
      "complete.anesthetic-no-amount"
    ]);
    expect(snap.counts).toEqual({ S0: 1, S1: 1, S2: 1, S3: 0, S4: 0 });
    expect(JSON.stringify(snap)).not.toMatch(/Amount missing|Bad tooth|Field/);
  });

  it("treats dose.anaesthetic-max.* as a killer", () => {
    const snap = buildFilingRollupSnapshot(
      report([
        finding({
          ruleId: "dose.anaesthetic-max.lidocaine",
          category: "medication-safety",
          severity: "S0",
          message: "Over max"
        })
      ]),
      ["medication"]
    );
    expect(snap.killerRuleIds).toEqual(["dose.anaesthetic-max.lidocaine"]);
  });
});

describe("parseFilingRollupSnapshot — tolerate junk", () => {
  it("returns null for missing / wrong version / garbage", () => {
    expect(parseFilingRollupSnapshot(null)).toBeNull();
    expect(parseFilingRollupSnapshot("not json")).toBeNull();
    expect(parseFilingRollupSnapshot({ v: 99, moduleIds: [] })).toBeNull();
    expect(parseFilingRollupSnapshot({ moduleIds: [] })).toBeNull();
  });

  it("round-trips a valid stamp", () => {
    const snap = buildFilingRollupSnapshot(report([]), ["preventive"]);
    expect(parseFilingRollupSnapshot(snap)).toEqual(snap);
    expect(parseFilingRollupSnapshot(JSON.stringify(snap))).toEqual(snap);
  });
});

describe("frozen audit markdown fallbacks", () => {
  const sample = [
    "# Dental-note audit",
    "",
    "- Status: READY FOR CLINICIAN REVIEW",
    "- Modules confirmed: Extraction Add-On; Direct Restorative Add-On",
    "",
    "## Issues",
    "",
    "| ID | Severity | Module | Location | Finding | Required action | Owner |",
    "|---|---|---|---|---|---|---|",
    "| 1 | S2 Review | Extraction | outcome | Missing outcome | Fix | clinician |",
    "| 2 | S1 Required | Core | diagnosis | Needed | Fill | clinician |",
    "| 3 | S0 Stop | note text | \"x\" | Stop | Fix | clinician |"
  ].join("\n");

  it("counts severities from the Issues table", () => {
    expect(parseSeverityCountsFromFrozenAudit(sample)).toEqual({
      S0: 1,
      S1: 1,
      S2: 1,
      S3: 0,
      S4: 0
    });
  });

  it("maps module titles back to catalog ids", () => {
    expect(parseModuleIdsFromFrozenAudit(sample)).toEqual([
      "direct-restorative",
      "extraction"
    ]);
  });

  it("skips unknown module titles rather than inventing ids", () => {
    expect(
      parseModuleIdsFromFrozenAudit("- Modules confirmed: Not A Real Module; Extraction Add-On")
    ).toEqual(["extraction"]);
  });
});

describe("buildPracticeFilingRollup — practice only, no scores", () => {
  it("aggregates modules, categories, and killers without author fields", () => {
    const a = buildFilingRollupSnapshot(
      report([
        finding({
          ruleId: "complete.consent-no-decision",
          category: "required",
          severity: "S2",
          message: "Consent"
        })
      ]),
      ["universal-core", "extraction"]
    );
    const b = buildFilingRollupSnapshot(
      report([
        finding({
          ruleId: "complete.consent-no-decision",
          category: "required",
          severity: "S2",
          message: "Consent"
        }),
        finding({
          ruleId: "complete.anesthetic-no-amount",
          category: "required",
          severity: "S2",
          message: "LA"
        })
      ]),
      ["universal-core", "direct-restorative"]
    );
    const rollup = buildPracticeFilingRollup([
      { filingRollup: a },
      { filingRollup: b },
      { filingRollup: null, auditReport: "" }
    ]);

    expect(rollup.notesTotal).toBe(3);
    expect(rollup.notesWithSnapshot).toBe(2);
    expect(rollup.notesWithKillers).toBe(2);
    expect(rollup.modules.map((m) => m.id)).toEqual(["direct-restorative", "extraction"]);
    expect(rollup.modules.every((m) => m.id !== "universal-core")).toBe(true);
    expect(rollup.categories[0]?.category).toBe("required");
    expect(rollup.killers.map((k) => k.ruleId).sort()).toEqual([
      "complete.anesthetic-no-amount",
      "complete.consent-no-decision"
    ]);
    expect(JSON.stringify(rollup)).not.toMatch(/authorId|authorName|scoreboard|ranking/i);
  });

  it("does not invent killer counts from markdown-only fallback", () => {
    const audit = [
      "- Modules confirmed: Extraction Add-On",
      "| 1 | S2 Review | Extraction | x | y | z | clinician |"
    ].join("\n");
    const rollup = buildPracticeFilingRollup([{ auditReport: audit }]);
    expect(rollup.notesWithSnapshot).toBe(1);
    expect(rollup.notesWithKillers).toBe(0);
    expect(rollup.killers).toEqual([]);
    expect(rollup.modules[0]?.id).toBe("extraction");
    expect(rollup.severityNotes.S2).toBe(1);
  });
});
