import { describe, expect, it } from "vitest";
import type { AuditFinding, AuditReport } from "@/lib/audit/types";
import type { OmissionReport } from "@/lib/audit/omissions";
import { isKillerFinding, KILLER_RULE_IDS, killerShortLabel } from "@/lib/audit/killers";
import { buildCheckNoteSummary } from "./checkNoteSummary";

function finding(
  partial: Pick<AuditFinding, "ruleId" | "severity"> & Partial<AuditFinding>
): AuditFinding {
  return {
    category: partial.category ?? "required",
    message: partial.message ?? partial.ruleId,
    ...partial
  };
}

function emptyReport(findings: AuditFinding[]): AuditReport {
  const counts = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return {
    findings,
    counts,
    status: "READY FOR CLINICIAN REVIEW",
    phiStops: []
  };
}

const noOmissions: OmissionReport = {
  answered: 0,
  licensed: 0,
  byLicence: [],
  rate: 0
};

describe("killers — litigation hoist set", () => {
  it("tags the Doctors Company / MedPro completeness gaps", () => {
    for (const id of [
      "complete.imaging-no-interpretation",
      "complete.anesthetic-no-amount",
      "complete.consent-no-decision",
      "complete.consent-thin-assertion",
      "complete.clinical-rationale"
    ]) {
      expect(KILLER_RULE_IDS.has(id)).toBe(true);
      expect(isKillerFinding(finding({ ruleId: id, severity: "S2" }))).toBe(true);
    }
  });

  it("tags wrong-site anatomy S0s and anaesthetic-max dose findings", () => {
    expect(isKillerFinding(finding({ ruleId: "anatomy.invalid-tooth", severity: "S0" }))).toBe(
      true
    );
    expect(
      isKillerFinding(finding({ ruleId: "dose.anaesthetic-max.lidocaine", severity: "S2" }))
    ).toBe(true);
  });

  it("does not treat every completeness cue as a killer", () => {
    expect(
      isKillerFinding(finding({ ruleId: "complete.extraction-no-outcome", severity: "S2" }))
    ).toBe(false);
    expect(isKillerFinding(finding({ ruleId: "required.missing", severity: "S1" }))).toBe(false);
  });

  it("gives each killer a short label that is not the raw rule id", () => {
    expect(killerShortLabel("complete.anesthetic-no-amount")).not.toMatch(/^complete\./);
    expect(killerShortLabel("dose.anaesthetic-max.articaine")).toMatch(/dose|amount|anesthetic/i);
  });
});

describe("buildCheckNoteSummary — storm", () => {
  it("MedPro-sparse: anesthetic + consent killers require ack before Confirm", () => {
    const report = emptyReport([
      finding({
        ruleId: "complete.anesthetic-no-amount",
        severity: "S2",
        message: "Anesthetic mentioned without an amount."
      }),
      finding({
        ruleId: "complete.consent-thin-assertion",
        severity: "S2",
        message: "Consent asserted without the conversation."
      }),
      finding({
        ruleId: "spelling.unknown",
        severity: "S4",
        message: "wihin"
      })
    ]);
    const summary = buildCheckNoteSummary({
      report,
      omissions: noOmissions,
      modules: [{ id: "universal-core", title: "Universal Core" }]
    });
    expect(summary.killers.map((k) => k.ruleId)).toEqual([
      "complete.anesthetic-no-amount",
      "complete.consent-thin-assertion"
    ]);
    expect(summary.requiresKillerAck).toBe(true);
    expect(summary.moduleTitles).toEqual(["Universal Core"]);
    // Spelling is noise at finish — not a stop, not a killer.
    expect(summary.openStops).toEqual([]);
  });

  it("clean note: no killers, no ack gate, modules listed", () => {
    const summary = buildCheckNoteSummary({
      report: emptyReport([]),
      omissions: { ...noOmissions, licensed: 2, answered: 10, rate: 0.2 },
      modules: [
        { id: "universal-core", title: "Universal Core" },
        { id: "preventive", title: "Preventive" }
      ]
    });
    expect(summary.killers).toEqual([]);
    expect(summary.requiresKillerAck).toBe(false);
    expect(summary.omissionCount).toBe(2);
    expect(summary.moduleTitles).toEqual(["Universal Core", "Preventive"]);
  });

  it("open S0/S1 that are not killers still surface as stops", () => {
    const report = emptyReport([
      finding({
        ruleId: "required.missing",
        severity: "S1",
        message: "Diagnosis is required.",
        fieldRef: { moduleId: "universal-core", fieldId: "diagnosis" }
      }),
      finding({
        ruleId: "complete.clinical-rationale",
        severity: "S2",
        message: "Rationale missing."
      })
    ]);
    const summary = buildCheckNoteSummary({
      report,
      omissions: noOmissions,
      modules: [{ id: "universal-core", title: "Universal Core" }]
    });
    expect(summary.killers).toHaveLength(1);
    expect(summary.openStops.map((s) => s.ruleId)).toEqual(["required.missing"]);
    expect(summary.requiresKillerAck).toBe(true);
  });

  it("does not mutate the audit report findings array", () => {
    const findings = [
      finding({ ruleId: "complete.imaging-no-interpretation", severity: "S2" }),
      finding({ ruleId: "anatomy.invalid-tooth", severity: "S0" })
    ];
    const report = emptyReport(findings);
    const before = report.findings.slice();
    buildCheckNoteSummary({
      report,
      omissions: noOmissions,
      modules: []
    });
    expect(report.findings).toEqual(before);
  });

  it("orders killers by severity (S0 before S2)", () => {
    const summary = buildCheckNoteSummary({
      report: emptyReport([
        finding({ ruleId: "complete.clinical-rationale", severity: "S2" }),
        finding({ ruleId: "anatomy.surface-stop", severity: "S0" })
      ]),
      omissions: noOmissions,
      modules: []
    });
    expect(summary.killers.map((k) => k.severity)).toEqual(["S0", "S2"]);
  });
});
