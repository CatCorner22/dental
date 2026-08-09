import { describe, expect, it } from "vitest";
import { checkFilingAuthority } from "./approval";
import { activeModules } from "@/lib/modules";
import { fieldKey, type NoteState } from "@/lib/schema/types";

const note = (moduleIds: string[], values: NoteState["values"] = {}): NoteState => ({
  selectedModuleIds: moduleIds,
  values
});

describe("checkFilingAuthority", () => {
  it("a dentist files anything", () => {
    const n = note(["sedation-anesthesia"]);
    expect(checkFilingAuthority("dentist", activeModules(n.selectedModuleIds), n).allowed).toBe(true);
  });

  it("unset files anything — the unconfigured-practice default is load-bearing", () => {
    const n = note(["robotic-surgery"]);
    expect(checkFilingAuthority("unset", activeModules(n.selectedModuleIds), n).allowed).toBe(true);
  });

  it("a hygienist cannot file a sedation record, and the message says how to move", () => {
    const n = note(["sedation-anesthesia"]);
    const verdict = checkFilingAuthority("hygienist", activeModules(n.selectedModuleIds), n);
    expect(verdict.allowed).toBe(false);
    expect(verdict.message).toMatch(/Transfer ownership/i);
    expect(verdict.message).toMatch(/dentist/i);
  });

  it("an assistant cannot file a robotic-surgery record", () => {
    const n = note(["robotic-surgery"]);
    expect(checkFilingAuthority("assistant", activeModules(n.selectedModuleIds), n).allowed).toBe(false);
  });

  it("a hygienist CAN file a routine note with no dentist-owned content", () => {
    const n = note(["preventive"], {
      [fieldKey("preventive", "prophylaxis-type")]: { kind: "select", value: "adult prophylaxis" }
    });
    expect(checkFilingAuthority("hygienist", activeModules(n.selectedModuleIds), n).allowed).toBe(true);
  });

  it("a filled diagnosis (Assessment section) makes the note dentist-filed", () => {
    const n = note(["preventive"], {
      [fieldKey("universal-core", "diagnosis")]: {
        kind: "text",
        value: "Generalized mild gingivitis."
      }
    });
    const verdict = checkFilingAuthority("hygienist", activeModules(n.selectedModuleIds), n);
    expect(verdict.allowed).toBe(false);
    expect(verdict.message).toMatch(/Dentist must file/i);
    expect(verdict.message).toMatch(/Transfer ownership/i);
  });

  it("a filled plan field makes the note dentist-filed", () => {
    const n = note(["preventive"], {
      [fieldKey("universal-core", "recommended-care")]: {
        kind: "text",
        value: "Four-quadrant scaling and root planing."
      }
    });
    expect(checkFilingAuthority("assistant", activeModules(n.selectedModuleIds), n).allowed).toBe(false);
  });

  it("an EMPTY diagnosis field does not trip the gate", () => {
    const n = note(["preventive"], {
      [fieldKey("universal-core", "diagnosis")]: { kind: "text", value: "   " }
    });
    expect(checkFilingAuthority("hygienist", activeModules(n.selectedModuleIds), n).allowed).toBe(true);
  });
});
