import { describe, expect, it } from "vitest";
import { activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import { composeAuditReport } from "@/lib/compose/composeAuditReport";
import { computeGates, runAudit } from "@/lib/audit/engine";
import type { NoteState } from "@/lib/schema/types";

// End-to-end: an IV moderate sedation surgical extraction note with three
// planted defects — a vague phrase, an invalid surface pairing, and a phone
// number — must be caught, gated, and reported.

const selected = ["imaging", "operative", "extraction", "sedation-anesthesia", "medication"];

const values: NoteState["values"] = {
  "universal-core.encounter-type": { kind: "select", value: "treatment visit" },
  "universal-core.visit-purpose": { kind: "text", value: "Removal of a painful lower right molar" },
  "universal-core.history-reviewed": { kind: "select", value: "yes" },
  // The safety block. A bare "reviewed: yes" tick used to stand in for all of
  // this; each of these is now a distinct statement, and every negative one
  // carries its own confirmation of whether it was asked or carried forward.
  "universal-core.history-changes-status": {
    kind: "select",
    value: "No changes reported to the medical history."
  },
  "universal-core.history-changes-confirm": {
    kind: "select",
    value: "Confirmed with the patient at this visit."
  },
  "universal-core.allergies-status": {
    kind: "select",
    value: "No known drug allergies (NKDA); other allergy types not excluded."
  },
  "universal-core.allergies-confirm": {
    kind: "select",
    value: "Confirmed with the patient at this visit and checked against the chart."
  },
  "universal-core.medications-status": {
    kind: "select",
    value: "Medication list reviewed; see the medication list in the clinical system."
  },
  "universal-core.premedication-status": { kind: "select", value: "Not required." },
  "universal-core.premedication-confirm": {
    kind: "select",
    value: "Confirmed with the patient at this visit and checked against the chart."
  },
  "universal-core.diagnosis": { kind: "text", value: "Nonrestorable carious tooth" },
  "universal-core.diagnosis-status": { kind: "select", value: "final" },
  "universal-core.recommended-care": { kind: "text", value: "Surgical extraction under intravenous moderate sedation" },
  "universal-core.patient-decision": { kind: "select", value: "accepted" },
  "universal-core.procedure-status": { kind: "select", value: "completed" },
  // Planted defect 1: vague phrase.
  "universal-core.complication-status": { kind: "text", value: "Patient tolerated the procedure well" },
  // Planted defect 3: phone number.
  "universal-core.instructions": { kind: "text", value: "Call the office at (615) 555-0142 with concerns" },

  "extraction.teeth": { kind: "teeth", teeth: ["30"] },
  "extraction.indication": { kind: "text", value: "Nonrestorable caries with pain on biting" },
  "extraction.procedure": { kind: "select", value: "surgical extraction" },

  // Planted defect 2: occlusal surface on an anterior tooth.
  "direct-restorative.teeth": { kind: "teeth", teeth: ["8"] },
  "direct-restorative.surfaces": { kind: "surfaces", byTooth: { "8": ["O"] } },

  "sedation-anesthesia.intended-depth": { kind: "select", value: "moderate sedation" },
  "sedation-anesthesia.achieved-depth": { kind: "select", value: "moderate sedation" },
  "sedation-anesthesia.route": { kind: "multiselect", values: ["intravenous"] }
};

describe("end-to-end IV sedation extraction draft", () => {
  const state: NoteState = { selectedModuleIds: [...selected, "direct-restorative"], values };
  const modules = activeModules(state.selectedModuleIds);
  const markdown = composeNote(state, modules);
  const report = runAudit({ note: state, modules, composedText: markdown });

  it("composes in the standardized order", () => {
    const order = [
      "## Universal Core",
      "## Imaging Add-On",
      "## Direct Restorative Add-On",
      "## Operative Add-On",
      "## Extraction Add-On",
      "## Sedation and Anesthesia Add-On"
    ];
    let last = -1;
    for (const heading of order) {
      const idx = markdown.indexOf(heading);
      if (idx === -1) continue; // modules without values are omitted
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
    expect(markdown.indexOf("## Universal Core")).toBeGreaterThanOrEqual(0);
  });

  it("catches all three planted defects", () => {
    expect(report.findings.some((f) => f.ruleId === "vague.tolerated-well")).toBe(true);
    expect(report.findings.some((f) => f.ruleId === "anatomy.surface-stop")).toBe(true);
    expect(report.findings.some((f) => f.ruleId === "phi.phone")).toBe(true);
  });

  it("blocks the line: any stop blocks export and email", () => {
    expect(report.status).toBe("BLOCKED");
    const gates = computeGates(report, false);
    expect(gates.exportAllowed).toBe(false);
    expect(gates.emailAllowed).toBe(false);
    // Overriding the privacy stop does NOT restore export while a wrong-site
    // anatomy stop still stands — a defective note never leaves the tool, by
    // any path. The PHI override only waives the PHI stop.
    const overridden = computeGates(report, true);
    expect(overridden.exportAllowed).toBe(false);
    expect(overridden.emailAllowed).toBe(false);
  });

  it("renders the standard audit report format", () => {
    const audit = composeAuditReport(report, modules, markdown);
    expect(audit).toContain("# Dental-note audit");
    expect(audit).toContain("- Status: Blocked");
    expect(audit).toContain("| ID | Severity | Module | Location | Finding | Required action | Owner |");
    expect(audit).toContain("## Draft note");
    expect(audit).toContain("## EDR-only finalization");
    expect(audit).not.toMatch(/\d+\s*%/); // never a percentage score
  });

  it("clears to a sendable state once the defects are fixed and required fields filled", () => {
    const fixed: NoteState = {
      selectedModuleIds: selected,
      values: {
        ...values,
        "universal-core.complication-status": {
          kind: "text",
          value: "No complication was observed during the stated procedure and observation period."
        },
        "universal-core.instructions": {
          kind: "text",
          value: "The clinician gave verbal and written postoperative instructions and confirmed teach-back."
        },
        // Fill the remaining required fields across active modules.
        "imaging.study-status": { kind: "select", value: "interpreted" },
        "imaging.modality": { kind: "select", value: "periapical radiograph" },
        "imaging.reason": { kind: "text", value: "Assess root anatomy before surgical extraction" },
        "operative.operation": { kind: "text", value: "Surgical extraction of a mandibular right first molar" },
        "operative.preop-diagnosis": { kind: "text", value: "Nonrestorable carious tooth" },
        "operative.site-status": { kind: "text", value: "Mandibular right first molar; procedure completed" },
        "operative.consent-pause": {
          kind: "select",
          value: "consent discussion recorded and procedural pause performed"
        },
        "operative.hemostasis": {
          kind: "text",
          value: "Pressure with gauze; the clinician observed a stopped bleed before discharge"
        },
        "sedation-anesthesia.fitness": {
          kind: "text",
          value: "The clinician determined the patient is a candidate for intravenous moderate sedation"
        },
        "sedation-anesthesia.permit-status": { kind: "select", value: "verified in the EDR workflow" },
        "sedation-anesthesia.team-roles": {
          kind: "text",
          value: "Operating dentist with sedation permit; one trained monitoring assistant"
        },
        "sedation-anesthesia.day-of-update": { kind: "select", value: "linked in the EDR" },
        "sedation-anesthesia.asa-exam": {
          kind: "text",
          value: "The clinician assigned ASA II and completed a focused airway examination"
        },
        "sedation-anesthesia.consent-reaffirmed": { kind: "select", value: "linked in the EDR" },
        "sedation-anesthesia.emergency-prep": {
          kind: "select",
          value: "confirmed for the depth intended and one level deeper"
        },
        "sedation-anesthesia.monitors-used": {
          kind: "multiselect",
          values: [
            "pulse oximetry (SpO2)",
            "blood pressure",
            "heart rate",
            "capnography (ETCO2)",
            "direct observation of consciousness"
          ]
        },
        "sedation-anesthesia.drugs": {
          kind: "select",
          value: "recorded in the time-oriented anesthesia record only"
        },
        "sedation-anesthesia.monitors": {
          kind: "select",
          value: "recorded in the time-oriented anesthesia record only"
        },
        "sedation-anesthesia.events": {
          kind: "text",
          value:
            "The patient did not move to a deeper level than intended, and no airway or emergency intervention was needed during the stated period."
        },
        "sedation-anesthesia.effectiveness": {
          kind: "text",
          value: "Sedation was effective and the planned extraction was completed"
        },
        "sedation-anesthesia.recovery-monitoring": {
          kind: "text",
          value: "A trained team member monitored recovery with continuous pulse oximetry"
        },
        "sedation-anesthesia.discharge-criteria": {
          kind: "text",
          value:
            "The patient met the office criteria for consciousness, oxygenation, ventilation, circulation, and mobility at baseline"
        },
        "sedation-anesthesia.discharge-determination": {
          kind: "text",
          value: "The clinician determined the patient was ready for discharge with an escort"
        },
        "sedation-anesthesia.responsible-adult": { kind: "select", value: "recorded in the EDR" },
        "sedation-anesthesia.reconciliation": { kind: "select", value: "yes" },
        "medication.action": { kind: "select", value: "administered" },
        "medication.drug": { kind: "text", value: "See the time-oriented anesthesia record" },
        "medication.dose-facts": {
          kind: "text",
          value: "Recorded in the time-oriented record and the EDR."
        },
        "medication.indication": { kind: "text", value: "Moderate sedation and local anesthesia for extraction" },
        "extraction.steps": {
          kind: "text",
          value: "Flap, bone removal, sectioning, elevation, delivery, socket inspection, irrigation"
        }
      }
    };
    const fixedModules = activeModules(fixed.selectedModuleIds);
    const fixedReport = runAudit({
      note: fixed,
      modules: fixedModules,
      composedText: composeNote(fixed, fixedModules)
    });
    const stops = fixedReport.findings.filter((f) => f.severity === "S0");
    const required = fixedReport.findings.filter((f) => f.severity === "S1");
    expect(stops).toEqual([]);
    expect(required).toEqual([]);
    expect(computeGates(fixedReport, false).emailAllowed).toBe(true);
  });
});
