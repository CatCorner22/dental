import { describe, expect, it } from "vitest";
import { runTextAudit } from "@/lib/audit/engine";
import {
  assertPersonaCorpusShape,
  PERSONA_AGENTS,
  PERSONA_BY_ID
} from "./persona-agents";
import {
  notesCoverAllPersonas,
  SYNTHETIC_TRAINING_NOTES
} from "./synthetic-notes";

// Honesty tests for the persona training corpus: the ten agents span the
// requested demographic/cognitive ranges, every agent authors a note, and
// planted audit defects actually fire. A training note that promises a gap
// the engine does not raise teaches people the tool lies.

describe("persona agents", () => {
  it("defines exactly ten agents spanning IQ 85–140, age 22–85, and openness ends", () => {
    expect(() => assertPersonaCorpusShape()).not.toThrow();
    expect(PERSONA_AGENTS).toHaveLength(10);
    expect(Math.min(...PERSONA_AGENTS.map((a) => a.age))).toBe(22);
    expect(Math.max(...PERSONA_AGENTS.map((a) => a.age))).toBe(85);
    expect(Math.min(...PERSONA_AGENTS.map((a) => a.iq))).toBe(85);
    expect(Math.max(...PERSONA_AGENTS.map((a) => a.iq))).toBe(140);
    expect(Math.min(...PERSONA_AGENTS.map((a) => a.openness))).toBeLessThanOrEqual(28);
    expect(Math.max(...PERSONA_AGENTS.map((a) => a.openness))).toBeGreaterThanOrEqual(88);
  });

  it("covers new-hire through emeritus career stages and multiple generations", () => {
    const stages = new Set(PERSONA_AGENTS.map((a) => a.careerStage));
    expect(stages.has("new-hire")).toBe(true);
    expect(stages.has("near-retirement")).toBe(true);
    expect(stages.has("emeritus")).toBe(true);
    const generations = new Set(PERSONA_AGENTS.map((a) => a.generation));
    expect(generations.size).toBeGreaterThanOrEqual(4);
  });

  it("has unique ids and a lookup map", () => {
    const ids = PERSONA_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(PERSONA_BY_ID.get(id)?.id).toBe(id);
    }
  });

  it("every agent carries failure modes, complaints, and litigation pattern tags", () => {
    for (const agent of PERSONA_AGENTS) {
      expect(agent.failureModes.length).toBeGreaterThan(0);
      expect(agent.commonComplaints.length).toBeGreaterThan(0);
      expect(agent.litigationPatterns.length).toBeGreaterThan(0);
      expect(agent.openness).toBeGreaterThanOrEqual(0);
      expect(agent.openness).toBeLessThanOrEqual(100);
    }
  });
});

describe("synthetic training notes", () => {
  it("covers every persona with exactly one primary note", () => {
    expect(notesCoverAllPersonas()).toBe(true);
    expect(SYNTHETIC_TRAINING_NOTES).toHaveLength(10);
  });

  it("every planted audit prefix actually fires", () => {
    for (const note of SYNTHETIC_TRAINING_NOTES) {
      const findings = runTextAudit(note.text);
      const ids = findings.map((f) => f.ruleId);
      for (const prefix of note.expectedAuditRulePrefixes) {
        expect(
          ids.some((id) => id.startsWith(prefix)),
          `${note.id} promises ${prefix} but audit raised: ${ids.join(", ") || "(none)"}`
        ).toBe(true);
      }
      expect(note.expectedDefectTags.length).toBeGreaterThan(0);
      expect(note.requiredEvidence.length).toBeGreaterThan(0);
      expect(note.researchBasis.length).toBeGreaterThan(0);
    }
  });

  it("contains no obvious PHI (names-as-labels, phone, SSN, DOB patterns)", () => {
    for (const note of SYNTHETIC_TRAINING_NOTES) {
      const findings = runTextAudit(note.text).filter((f) => f.ruleId.startsWith("phi."));
      expect(findings, `${note.id} must stay de-identified`).toEqual([]);
      expect(note.text).not.toMatch(/\b(?:Mr|Mrs|Ms|Dr)\.\s+[A-Z][a-z]+\b/);
      expect(note.text).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
      expect(note.text).not.toMatch(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/);
    }
  });

  it("includes the MedPro-class sparse RCT pattern and a Curve template-residue case", () => {
    const sparse = SYNTHETIC_TRAINING_NOTES.find((n) => n.id === "note.ray-thompson.rct-sparse");
    expect(sparse?.text.toLowerCase()).toContain("with local");
    expect(sparse?.researchBasis).toContain("sparse-operative");

    const template = SYNTHETIC_TRAINING_NOTES.find((n) => n.id === "note.denise-ortiz.crown-template");
    expect(template?.text).toMatch(/\[material\]/);
    expect(template?.text).toMatch(/\bTBD\b/);
    expect(template?.researchBasis).toContain("curve-template-minimal");
  });
});
