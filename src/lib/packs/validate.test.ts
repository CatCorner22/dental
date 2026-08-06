import { describe, expect, it } from "vitest";
import { validatePackBody } from "./validate";

describe("validatePackBody", () => {
  it("accepts a restorative pack of shipped short blocks", () => {
    const r = validatePackBody({
      title: "Restoration day",
      description: "Usual restorative modules and starters.",
      moduleIds: ["direct-restorative", "imaging", "medication"],
      blockIds: ["local-anesthetic", "no-complications", "consent-conversation"],
      authorRoles: ["dentist", "assistant"]
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.moduleIds).toContain("direct-restorative");
      expect(r.value.blockIds[0]).toBe("local-anesthetic");
    }
  });

  it("refuses Universal Core in the module list", () => {
    const r = validatePackBody({
      title: "Bad",
      moduleIds: ["universal-core"],
      blockIds: ["medical-history-reviewed"]
    });
    expect(r.ok).toBe(false);
  });

  it("refuses full DES-12 scaffolds", () => {
    const r = validatePackBody({
      title: "Too big",
      moduleIds: ["examination"],
      blockIds: ["des12-master"]
    });
    expect(r.ok).toBe(false);
  });

  it("refuses an empty pack", () => {
    const r = validatePackBody({ title: "Empty", moduleIds: [], blockIds: [] });
    expect(r.ok).toBe(false);
  });
});
