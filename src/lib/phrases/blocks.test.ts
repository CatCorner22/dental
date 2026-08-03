import { describe, expect, it } from "vitest";
import { VERIFIED_BLOCKS } from "./blocks";
import { runResidueRule } from "@/lib/audit/rules/residue";
import { runTextAudit } from "@/lib/audit/engine";

// The blocks' safety story is that they CANNOT be filed untouched. These
// tests hold the three locks in place as the library grows.

describe("verified blocks", () => {
  it("every block carries at least one placeholder the residue rule blocks", () => {
    for (const block of VERIFIED_BLOCKS) {
      const findings = runResidueRule(block.body);
      expect(
        findings.some((f) => f.ruleId === "residue.angle-placeholder"),
        `${block.id} must contain an unfilled <placeholder> so it cannot be filed as-is`
      ).toBe(true);
    }
  });

  it("every block demands at least two distinct verifications", () => {
    for (const block of VERIFIED_BLOCKS) {
      expect(block.verify.length, block.id).toBeGreaterThanOrEqual(2);
      // Each verification is a substantive assertion, not a nod.
      for (const v of block.verify) {
        expect(v.split(/\s+/).length, `${block.id}: "${v}"`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("every verification states a fact, never a mere acknowledgment", () => {
    for (const block of VERIFIED_BLOCKS) {
      for (const v of block.verify) {
        expect(v.toLowerCase()).not.toMatch(/^i (agree|accept|acknowledge|understand)\b/);
      }
    }
  });

  it("a filled-in block passes the residue rule", () => {
    const filled = VERIFIED_BLOCKS[0].body.replace(/<[^<>]+>/g, "documented specifics");
    const findings = runResidueRule(filled);
    expect(findings.filter((f) => f.ruleId === "residue.angle-placeholder")).toHaveLength(0);
  });

  it("block boilerplate raises no vague-phrase or stigmatizing findings of its own", () => {
    for (const block of VERIFIED_BLOCKS) {
      const filled = block.body.replace(/<[^<>]+>/g, "documented specifics");
      const findings = runTextAudit(filled).filter(
        (f) => f.category === "vague-phrase" || f.category === "stigmatizing"
      );
      expect(findings, `${block.id}: ${findings.map((f) => f.message).join("; ")}`).toHaveLength(0);
    }
  });

  it("ids are unique", () => {
    const ids = VERIFIED_BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
