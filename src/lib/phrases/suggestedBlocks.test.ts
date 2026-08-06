import { describe, expect, it } from "vitest";

import {
  insertFieldForBlock,
  preferredInsertFieldId,
  suggestedBlocksFor,
  SUGGESTABLE_BLOCK_IDS
} from "./suggestedBlocks";

describe("suggestedBlocksFor", () => {
  it("stays silent on the narrative — first-paint must stay a typing surface", () => {
    expect(
      suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "narrative",
        selectedModuleIds: ["universal-core", "direct-restorative"],
        clinicalRole: "dentist"
      })
    ).toEqual([]);
  });

  it("offers medical history on history-review for every role", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "history-review",
      selectedModuleIds: ["universal-core"],
      clinicalRole: "hygienist"
    }).map((b) => b.id);
    expect(ids).toContain("medical-history-reviewed");
    expect(ids.length).toBeLessThanOrEqual(3);
  });

  it("ranks anesthetic and complications for care-delivered on a restorative visit", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "care-delivered",
      selectedModuleIds: ["universal-core", "direct-restorative", "medication", "imaging"],
      clinicalRole: "dentist"
    }).map((b) => b.id);
    expect(ids[0]).toBe("local-anesthetic");
    expect(ids).toContain("no-complications");
    expect(ids).not.toContain("postop-instructions");
  });

  it("puts post-op instructions on handoff, not care-delivered", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "handoff",
      selectedModuleIds: ["universal-core", "extraction"],
      clinicalRole: "dentist"
    }).map((b) => b.id);
    expect(ids).toContain("postop-instructions");
  });

  it("surfaces radiograph wording on objective when imaging is selected", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "objective",
      selectedModuleIds: ["universal-core", "imaging"],
      clinicalRole: "dentist"
    }).map((b) => b.id);
    expect(ids).toEqual(["radiograph-interpretation"]);
  });

  it("hides referral suggestions from hygienists and assistants", () => {
    for (const role of ["hygienist", "assistant"] as const) {
      const ids = suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "handoff",
        selectedModuleIds: ["universal-core", "examination"],
        clinicalRole: role
      }).map((b) => b.id);
      expect(ids, role).not.toContain("referral");
    }
  });

  it("never returns non-suggestable full scaffolds", () => {
    const ids = suggestedBlocksFor({
      moduleId: "direct-restorative",
      sectionId: "procedure",
      selectedModuleIds: ["universal-core", "direct-restorative"],
      clinicalRole: "dentist",
      limit: 10
    }).map((b) => b.id);
    expect(ids.every((id) => (SUGGESTABLE_BLOCK_IDS as readonly string[]).includes(id))).toBe(
      true
    );
    expect(ids).not.toContain("des12-master");
    expect(ids).not.toContain("operative-with-assistant");
  });

  it("returns at most three blocks", () => {
    const blocks = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "care-delivered",
      selectedModuleIds: ["universal-core", "extraction", "medication", "imaging"],
      clinicalRole: "dentist",
      limit: 3
    });
    expect(blocks.length).toBeLessThanOrEqual(3);
  });
});

describe("preferredInsertFieldId", () => {
  it("prefers a textarea over a text field", () => {
    expect(
      preferredInsertFieldId([
        { id: "a", type: "text" },
        { id: "b", type: "textarea" }
      ])
    ).toBe("b");
  });

  it("returns null when the section has no prose field", () => {
    expect(preferredInsertFieldId([{ id: "x", type: "select" }])).toBeNull();
  });
});

describe("insertFieldForBlock", () => {
  it("routes no-complications to complication-status", () => {
    expect(
      insertFieldForBlock("care-delivered", "no-complications", [
        { id: "procedure-status", type: "select" },
        { id: "complication-status", type: "text" },
        { id: "patient-response", type: "text" }
      ])
    ).toBe("complication-status");
  });

  it("routes post-op instructions to the handoff instructions textarea", () => {
    expect(
      insertFieldForBlock("handoff", "postop-instructions", [
        { id: "condition-at-end", type: "text" },
        { id: "instructions", type: "textarea" }
      ])
    ).toBe("instructions");
  });
});
