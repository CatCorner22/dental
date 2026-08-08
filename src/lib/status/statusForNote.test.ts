import { describe, expect, it, vi } from "vitest";
import type { NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";

// Clear audit so filing authority is the only finish gate under test. Real
// module notes almost always carry S1 required-field noise; that path is
// covered elsewhere — here we prove the list chip cannot say Ready when
// Submit would refuse for dentist filing (UIX-001).
vi.mock("@/lib/audit/engine", () => ({
  runAudit: () => ({
    counts: { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 },
    phiStops: [],
    findings: []
  })
}));
vi.mock("@/lib/compose/composeNote", () => ({
  composeNote: () => "composed"
}));

import { statusForNote } from "./statusForNote";

function dentistFiledNote(): NoteState {
  return {
    selectedModuleIds: ["preventive"],
    values: {
      [fieldKey("universal-core", "diagnosis")]: {
        kind: "text",
        value: "Generalized mild gingivitis."
      }
    }
  };
}

describe("statusForNote — filing authority on the cached chip (UIX-001 list)", () => {
  it("does not cache Ready for a hygienist when dentist filing is required", () => {
    const { status } = statusForNote(dentistFiledNote(), {
      submitted: false,
      lastSendFailed: false,
      clinicalRole: "hygienist"
    });
    expect(status).toBe("handoff");
  });

  it("caches Ready for a dentist on the same clean note", () => {
    const { status } = statusForNote(dentistFiledNote(), {
      submitted: false,
      lastSendFailed: false,
      clinicalRole: "dentist"
    });
    expect(status).toBe("ready");
  });

  it("omitted role keeps legacy Ready (callers that have not wired filing yet)", () => {
    const { status } = statusForNote(dentistFiledNote(), {
      submitted: false,
      lastSendFailed: false
    });
    expect(status).toBe("ready");
  });
});
