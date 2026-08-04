import { describe, expect, it } from "vitest";
import { clusterTokens, normalizeSubject } from "./cluster";
import { areDentalSynonyms, synonymKey } from "./synonyms";

describe("dental synonym map (learning ledger)", () => {
  it("maps postop instruction surfaces to one key", () => {
    expect(synonymKey("post-op instructions")).toBe(synonymKey("postopinstr"));
    expect(areDentalSynonyms("postoperative instructions", "post-op instr")).toBe(true);
  });

  it("does not synonym-merge distinct clinical abbreviations", () => {
    expect(areDentalSynonyms("SRP", "RCT")).toBe(false);
    expect(areDentalSynonyms("N2O", "GI")).toBe(false);
  });

  it("clusters synonym surfaces even when bigram similarity is low", () => {
    const clusters = clusterTokens(["post-op instructions", "postopinstr", "BPE"]);
    const postop = clusters.find((c) =>
      c.members.some((m) => normalizeSubject(m).includes("postop"))
    );
    expect(postop?.members.length).toBeGreaterThanOrEqual(2);
    expect(clusters.some((c) => c.members.includes("BPE"))).toBe(true);
  });
});
