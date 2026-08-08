import { describe, expect, it } from "vitest";

import {
  packStartersForAppliedModules
} from "./packStartersForModules";
import type { PublishedPackLite } from "./publishedForVisit";

const PACKS: PublishedPackLite[] = [
  {
    id: 1,
    title: "Hygiene prophy",
    description: "",
    moduleIds: ["periodontal"],
    blockIds: ["medical-history-reviewed", "no-complications"],
    authorRoles: ["hygienist"]
  },
  {
    id: 2,
    title: "Restorative",
    description: "",
    moduleIds: ["direct-restorative"],
    blockIds: ["local-anesthetic", "consent-conversation", "des-12-general"],
    authorRoles: ["dentist", "assistant"]
  },
  {
    id: 3,
    title: "Emergency referral",
    description: "",
    moduleIds: ["emergency"],
    blockIds: ["referral", "consent-conversation"],
    authorRoles: []
  },
  {
    id: 4,
    title: "Full scaffold dump",
    description: "",
    moduleIds: ["direct-restorative"],
    blockIds: ["des-12-general", "operative-scaffold"],
    authorRoles: ["dentist"]
  }
];

describe("packStartersForAppliedModules — Fast Lane offer contract", () => {
  it("returns nothing when no modules were applied", () => {
    expect(packStartersForAppliedModules(PACKS, "dentist", []).blocks).toEqual([]);
  });

  it("returns nothing when no pack overlaps the applied modules", () => {
    expect(
      packStartersForAppliedModules(PACKS, "dentist", ["cosmetic"]).blocks
    ).toEqual([]);
  });

  it("offers only suggestable blocks — never DES-12 / full scaffolds", () => {
    const offer = packStartersForAppliedModules(PACKS, "dentist", ["direct-restorative"]);
    expect(offer.blocks.map((b) => b.id)).toEqual([
      "local-anesthetic",
      "consent-conversation"
    ]);
    expect(offer.packTitles).toEqual(["Restorative"]);
    expect(offer.blocks.some((b) => b.id.startsWith("des-"))).toBe(false);
  });

  it("returns empty when a pack lists only non-suggestable scaffolds", () => {
    const onlyDump: PublishedPackLite[] = [PACKS[3]!];
    expect(
      packStartersForAppliedModules(onlyDump, "dentist", ["direct-restorative"]).blocks
    ).toEqual([]);
  });

  it("filters packs by clinical role", () => {
    const forHyg = packStartersForAppliedModules(PACKS, "hygienist", ["periodontal"]);
    expect(forHyg.blocks.map((b) => b.id)).toEqual([
      "medical-history-reviewed",
      "no-complications"
    ]);
    expect(
      packStartersForAppliedModules(PACKS, "hygienist", ["direct-restorative"]).blocks
    ).toEqual([]);
  });

  it("hides dentist-judgement referral from hygienist / assistant", () => {
    const forAsst = packStartersForAppliedModules(PACKS, "assistant", ["emergency"]);
    expect(forAsst.blocks.map((b) => b.id)).toEqual(["consent-conversation"]);
    expect(forAsst.blocks.some((b) => b.id === "referral")).toBe(false);

    const forDentist = packStartersForAppliedModules(PACKS, "dentist", ["emergency"]);
    expect(forDentist.blocks.map((b) => b.id)).toEqual([
      "referral",
      "consent-conversation"
    ]);
  });

  it("dedupes block ids across matching packs and caps the list", () => {
    const twin: PublishedPackLite[] = [
      {
        id: 10,
        title: "A",
        description: "",
        moduleIds: ["direct-restorative"],
        blockIds: ["local-anesthetic", "no-complications"],
        authorRoles: ["dentist"]
      },
      {
        id: 11,
        title: "B",
        description: "",
        moduleIds: ["direct-restorative"],
        blockIds: ["local-anesthetic", "consent-conversation", "postop-instructions"],
        authorRoles: ["dentist"]
      }
    ];
    const offer = packStartersForAppliedModules(twin, "dentist", ["direct-restorative"], 3);
    expect(offer.blocks.map((b) => b.id)).toEqual([
      "local-anesthetic",
      "no-complications",
      "consent-conversation"
    ]);
    expect(offer.packTitles).toEqual(["A", "B"]);
  });

  it("is idempotent for the same inputs", () => {
    const a = packStartersForAppliedModules(PACKS, "dentist", ["direct-restorative"]);
    const b = packStartersForAppliedModules(PACKS, "dentist", ["direct-restorative"]);
    expect(a).toEqual(b);
  });
});
