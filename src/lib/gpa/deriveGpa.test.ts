import { describe, expect, it } from "vitest";
import { deriveGpa, GPA_VERSION } from "./deriveGpa";
import { buildReport, computeGates, runAudit } from "@/lib/audit/engine";
import { runJustificationRules } from "@/lib/audit/rules/justification";
import { activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import type { AuditFinding } from "@/lib/audit/types";
import type { NoteState } from "@/lib/schema/types";

const finding = (over: Partial<AuditFinding>): AuditFinding => ({
  ruleId: "x",
  category: "vague-phrase",
  severity: "S2",
  message: "m",
  occurrences: 1,
  ...over
});

const emptyNote: NoteState = { selectedModuleIds: [], values: {} };

describe("deriveGpa", () => {
  it("a clean report on a note with no requirements is a 4.00 A", () => {
    const r = deriveGpa(buildReport([]), emptyNote, []);
    expect(r.gpa).toBe(4);
    expect(r.letter).toBe("A");
    expect(r.gpaVersion).toBe(GPA_VERSION);
    expect(r.subscores).toEqual({
      completeness: 1,
      specificity: 1,
      consistency: 1,
      justification: 1
    });
  });

  it("vague wording drains specificity, not consistency", () => {
    const r = deriveGpa(
      buildReport([
        finding({ ruleId: "vague.a", category: "vague-phrase" }),
        finding({ ruleId: "vague.b", category: "vague-phrase" })
      ]),
      emptyNote,
      []
    );
    expect(r.subscores.specificity).toBeCloseTo(0.7);
    expect(r.subscores.consistency).toBe(1);
  });

  it("a medication-safety collision drains consistency hard", () => {
    const r = deriveGpa(
      buildReport([finding({ ruleId: "medsafe.x", category: "medication-safety", severity: "S1" })]),
      emptyNote,
      []
    );
    expect(r.subscores.consistency).toBe(0.75);
  });

  it("justification gaps cost half an axis each", () => {
    const r = deriveGpa(
      buildReport([finding({ ruleId: "justify.srp-periodontal-evidence", category: "required" })]),
      emptyNote,
      []
    );
    expect(r.subscores.justification).toBe(0.5);
    // And they do NOT double-count into completeness.
    expect(r.subscores.completeness).toBe(1);
  });

  it("letter bands match the spec", () => {
    expect(deriveGpa(buildReport([]), emptyNote, []).letter).toBe("A");
    const c = deriveGpa(
      buildReport(
        Array.from({ length: 5 }, (_, i) =>
          finding({ ruleId: `vague.${i}`, category: "vague-phrase" })
        ).concat([
          finding({ ruleId: "medsafe.a", category: "medication-safety" }),
          finding({ ruleId: "medsafe.b", category: "medication-safety" }),
          finding({ ruleId: "justify.x", category: "required" })
        ])
      ),
      emptyNote,
      []
    );
    expect(c.gpa).toBeLessThan(3.0);
    expect(["C", "F"]).toContain(c.letter);
  });

  it("NEVER gates: a note the gates allow keeps its gates whatever the GPA says", () => {
    const report = buildReport(
      Array.from({ length: 10 }, (_, i) => finding({ ruleId: `vague.${i}`, category: "vague-phrase" }))
    );
    const grade = deriveGpa(report, emptyNote, []);
    expect(grade.gpa).toBeLessThan(3);
    // S2-only report: both gates stay open regardless of the grade.
    const gates = computeGates(report, false);
    expect(gates.exportAllowed).toBe(true);
    expect(gates.emailAllowed).toBe(true);
  });
});

describe("justification rules", () => {
  it("SRP without periodontal evidence is flagged; with it, silent", () => {
    expect(
      runJustificationRules("Scaling and root planing completed, all quadrants.").map((f) => f.ruleId)
    ).toContain("justify.srp-periodontal-evidence");
    expect(
      runJustificationRules(
        "Scaling and root planing completed. Probing depths 4-6 mm generalized with radiographic bone loss."
      )
    ).toHaveLength(0);
  });

  it("core buildup without the retention narrative is flagged", () => {
    expect(runJustificationRules("Core buildup placed on tooth 30.").map((f) => f.ruleId)).toContain(
      "justify.buildup-retention"
    );
    expect(
      runJustificationRules(
        "Core buildup placed on tooth 30; insufficient retentive tooth structure remained after caries excavation."
      )
    ).toHaveLength(0);
  });

  it("crown work without stated necessity is flagged", () => {
    expect(runJustificationRules("Crown prep completed on 19.").map((f) => f.ruleId)).toContain(
      "justify.crown-necessity"
    );
    expect(
      runJustificationRules("Crown prep completed on 19 due to fractured lingual cusp.")
    ).toHaveLength(0);
  });

  it("never fires without the procedure", () => {
    expect(runJustificationRules("Adult prophylaxis completed. OHI given.")).toHaveLength(0);
  });
});

describe("end to end on a real module", () => {
  it("grades a composed note against the full audit", () => {
    const note: NoteState = { selectedModuleIds: ["preventive"], values: {} };
    const modules = activeModules(note.selectedModuleIds);
    const report = runAudit({
      note,
      modules,
      composedText: composeNote(note, modules, { officeName: null })
    });
    const grade = deriveGpa(report, note, modules);
    // An empty required-field note must not grade an A.
    expect(grade.gpa).toBeLessThan(3.7);
    expect(grade.subscores.completeness).toBeLessThan(1);
  });
});
