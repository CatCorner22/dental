import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEVERITY_CLASS, STATUS_CLASS, SEVERITY_ORDER } from "./types";
import type { OverallStatus } from "./types";

// Severity is this app's core safety vocabulary. S0 means stop; S3 means style.
// The ramp that renders it existed TWICE — `SEVERITY_STYLES` in AuditPanel.tsx
// and `SEV_CLASS` in Standardizer.tsx — and the two had quietly drifted apart
// at S3 and S4. The same finding rendered blue in the note builder and grey on
// the Standardize page, telling a clinician that an informational item was a
// different KIND of item depending on which screen they were looking at.
//
// These tests exist so it cannot happen again: one ramp, complete, and no
// component may define a second one.

const COMPONENTS = [
  "src/components/builder/AuditPanel.tsx",
  "src/components/standardize/Standardizer.tsx"
];

const STATUSES: OverallStatus[] = [
  "BLOCKED",
  "NEEDS CLINICIAN ACTION",
  "READY FOR CLINICIAN REVIEW",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
];

describe("one severity ramp, shared", () => {
  it("styles every severity the audit can emit", () => {
    for (const s of SEVERITY_ORDER) {
      expect(SEVERITY_CLASS[s], `no style for ${s}`).toBeTruthy();
    }
    expect(Object.keys(SEVERITY_CLASS).sort()).toEqual([...SEVERITY_ORDER].sort());
  });

  it("styles every overall status", () => {
    for (const s of STATUSES) {
      expect(STATUS_CLASS[s], `no style for ${s}`).toBeTruthy();
    }
  });

  it("gives each severity a distinct appearance", () => {
    // Two severities that look identical are two severities a reader cannot
    // tell apart, which defeats the point of grading them.
    const seen = new Set(Object.values(SEVERITY_CLASS));
    expect(seen.size).toBe(SEVERITY_ORDER.length);
  });

  it("no component defines its own ramp", () => {
    // The drift was possible because the mapping lived in the components.
    for (const rel of COMPONENTS) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, `${rel} must import the shared ramp`).toContain("SEVERITY_CLASS");
      for (const localName of ["SEVERITY_STYLES", "SEV_CLASS", "STATUS_STYLES"]) {
        expect(
          src.includes(`const ${localName}`),
          `${rel} re-declares ${localName} — use the shared ramp in lib/audit/types`
        ).toBe(false);
      }
    }
  });

  it("keeps the severity ordering the audit sorts by", () => {
    expect(SEVERITY_ORDER).toEqual(["S0", "S1", "S2", "S3", "S4"]);
  });
});
