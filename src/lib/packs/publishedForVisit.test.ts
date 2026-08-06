import { describe, expect, it } from "vitest";
import {
  orderPicksByPackModules,
  packBlockIdsForVisit,
  packPreferredModuleIds,
  packsForVisit,
  type PublishedPackLite
} from "./publishedForVisit";

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
    blockIds: ["local-anesthetic", "consent-conversation"],
    authorRoles: ["dentist", "assistant"]
  },
  {
    id: 3,
    title: "Open audience",
    description: "",
    moduleIds: ["emergency"],
    blockIds: ["referral"],
    authorRoles: []
  }
];

describe("packsForVisit", () => {
  it("filters by clinical role when the pack names an audience", () => {
    const forHyg = packsForVisit(PACKS, "hygienist", []);
    expect(forHyg.map((p) => p.id).sort()).toEqual([1, 3]);
  });

  it("requires module overlap once the note has add-ons", () => {
    const forDentist = packsForVisit(PACKS, "dentist", ["direct-restorative"]);
    expect(forDentist.map((p) => p.id)).toEqual([2]);
  });
});

describe("packBlockIdsForVisit", () => {
  it("dedupes block ids across matching packs", () => {
    expect(packBlockIdsForVisit(PACKS, "hygienist", [])).toEqual([
      "medical-history-reviewed",
      "no-complications",
      "referral"
    ]);
  });
});

describe("orderPicksByPackModules", () => {
  it("surfaces pack-overlapping picks first without dropping others", () => {
    const picks = [
      { id: "a", moduleIds: ["emergency"] },
      { id: "b", moduleIds: ["periodontal"] },
      { id: "c", moduleIds: ["cosmetic"] }
    ];
    const preferred = packPreferredModuleIds(PACKS, "hygienist");
    expect(orderPicksByPackModules(picks, preferred).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
  });
});
