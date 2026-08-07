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

  it("stays silent on add-on modules — one strip per viewport", () => {
    expect(
      suggestedBlocksFor({
        moduleId: "direct-restorative",
        sectionId: "main",
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

  it("does not lead a hygiene-only visit with local anesthetic on care-delivered", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "care-delivered",
      selectedModuleIds: ["universal-core", "preventive", "imaging"],
      clinicalRole: "hygienist"
    }).map((b) => b.id);
    expect(ids).not.toContain("local-anesthetic");
    expect(ids).toContain("no-complications");
  });

  it("ranks anesthetic for care-delivered on a restorative visit", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "care-delivered",
      selectedModuleIds: ["universal-core", "direct-restorative", "medication", "imaging"],
      clinicalRole: "dentist"
    }).map((b) => b.id);
    expect(ids[0]).toBe("local-anesthetic");
    expect(ids).toContain("no-complications");
  });

  it("surfaces radiograph wording on objective only when imaging is selected", () => {
    expect(
      suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "objective",
        selectedModuleIds: ["universal-core"],
        clinicalRole: "dentist"
      }).map((b) => b.id)
    ).toEqual([]);
    expect(
      suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "objective",
        selectedModuleIds: ["universal-core", "imaging"],
        clinicalRole: "dentist"
      }).map((b) => b.id)
    ).toEqual(["radiograph-interpretation"]);
  });

  it("offers postop on handoff for extraction, not for hygiene-only", () => {
    expect(
      suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "handoff",
        selectedModuleIds: ["universal-core", "preventive", "imaging"],
        clinicalRole: "hygienist"
      }).map((b) => b.id)
    ).not.toContain("postop-instructions");

    expect(
      suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "handoff",
        selectedModuleIds: ["universal-core", "extraction"],
        clinicalRole: "dentist"
      }).map((b) => b.id)
    ).toContain("postop-instructions");
  });

  it("hides referral suggestions from hygienists and assistants", () => {
    for (const role of ["hygienist", "assistant"] as const) {
      const ids = suggestedBlocksFor({
        moduleId: "universal-core",
        sectionId: "handoff",
        selectedModuleIds: ["universal-core", "examination", "extraction"],
        clinicalRole: role
      }).map((b) => b.id);
      expect(ids, role).not.toContain("referral");
    }
  });

  it("never returns non-suggestable full scaffolds", () => {
    const ids = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "care-delivered",
      selectedModuleIds: ["universal-core", "direct-restorative"],
      clinicalRole: "dentist",
      limit: 10
    }).map((b) => b.id);
    expect(ids.every((id) => (SUGGESTABLE_BLOCK_IDS as readonly string[]).includes(id))).toBe(
      true
    );
    expect(ids).not.toContain("des12-master");
  });

  it("boosts pack block ids into the shortlist when they have a field home", () => {
    const without = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "history-review",
      selectedModuleIds: ["universal-core"],
      clinicalRole: "dentist"
    }).map((b) => b.id);
    expect(without).toContain("medical-history-reviewed");

    const withPack = suggestedBlocksFor({
      moduleId: "universal-core",
      sectionId: "history-review",
      selectedModuleIds: ["universal-core"],
      clinicalRole: "dentist",
      packBlockIds: ["medical-history-reviewed", "consent-conversation"]
    }).map((b) => b.id);
    // consent belongs on plan, not history-review — pack boost must not invent a home.
    expect(withPack[0]).toBe("medical-history-reviewed");
    expect(withPack).not.toContain("consent-conversation");
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
