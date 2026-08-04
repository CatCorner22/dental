import { describe, expect, it } from "vitest";
import { bigramSimilarity, clusterTokens, normalizeSubject } from "./cluster";

describe("learning surface clustering", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeSubject("Post-Op")).toBe(normalizeSubject("postop"));
  });

  it("scores near-duplicate surfaces highly", () => {
    expect(bigramSimilarity("postop", "post-op")).toBeGreaterThan(0.8);
  });

  it("clusters surface variants into one canonical subject", () => {
    const clusters = clusterTokens(["postop", "post-op", "BPE", "bpe"]);
    expect(clusters.length).toBeLessThanOrEqual(2);
    const postop = clusters.find((c) => normalizeSubject(c.canonical) === "postop");
    expect(postop?.members.length).toBeGreaterThan(1);
  });

  it("keeps clearly distinct abbreviations separate", () => {
    const clusters = clusterTokens(["SRP", "RCT", "N2O"]);
    expect(clusters).toHaveLength(3);
  });
});
