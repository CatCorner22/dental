import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SEAL } from "./SEAL";
import { judgeSeal, explainSeal, REQUIRED_SEALED_FILES } from "./seal";
import { PIPELINE_STEPS, KNOWN_STATUSES, LIMITS } from "./contract";
import { byteAuditVerify, explainVerdict, type FinalArtifact } from "./verify";

const HERE = __dirname;

function sealedOnDisk(dir = HERE, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, sealedOnDisk(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith(".ts") && rel !== "SEAL.ts" && !rel.endsWith(".test.ts")) {
      out[rel] = createHash("sha256").update(readFileSync(path.join(dir, rel))).digest("hex");
    }
  }
  return out;
}

describe("the seal", () => {
  it("matches what is on disk", () => {
    const verdict = judgeSeal(SEAL, sealedOnDisk());
    expect(verdict.intact, explainSeal(verdict)).toBe(true);
  });

  it("seals the load-bearing files by name, not by count", () => {
    // "At least four files" is satisfied by four trivial ones while the verifier
    // itself goes missing. Naming them makes that a visible deletion.
    for (const required of REQUIRED_SEALED_FILES) {
      expect(Object.keys(SEAL.files), `${required} must be sealed`).toContain(required);
    }
  });

  it("refuses a manifest with the verifier dropped out of it", () => {
    const gutted = { version: SEAL.version, files: { "contract.ts": SEAL.files["contract.ts"] } };
    expect(judgeSeal(gutted, { "contract.ts": SEAL.files["contract.ts"] }).intact).toBe(false);
  });

  it("notices a modified file", () => {
    const tampered = { ...sealedOnDisk() };
    tampered["verify.ts"] = "0".repeat(64);
    const verdict = judgeSeal(SEAL, tampered);
    expect(verdict.intact).toBe(false);
    expect(verdict.failures.some((f) => f.kind === "modified")).toBe(true);
  });

  it("notices a file ADDED to the sealed directory", () => {
    // The half that is easy to forget. Checking only that known files are
    // unchanged lets someone drop in an override module and import it from the
    // verifier while every recorded hash stays perfectly intact.
    const smuggled = { ...sealedOnDisk(), "override.ts": "a".repeat(64) };
    const verdict = judgeSeal(SEAL, smuggled);
    expect(verdict.intact).toBe(false);
    expect(verdict.failures.some((f) => f.kind === "unsealed")).toBe(true);
  });

  it("notices a deleted file", () => {
    const reduced = { ...sealedOnDisk() };
    delete reduced["verify.ts"];
    const verdict = judgeSeal(SEAL, reduced);
    expect(verdict.intact).toBe(false);
    expect(verdict.failures.some((f) => f.kind === "missing")).toBe(true);
  });
});

describe("independence", () => {
  it("imports nothing from the rest of the application", () => {
    // The property that makes ByteAudit a second opinion rather than an echo.
    // If it imported the composer, the stamp builder, or the audit engine, a bug
    // in any of those would appear identically on both sides of every comparison
    // and cancel itself out.
    //
    // Node built-ins are allowed in the TEST only; the sealed sources must be
    // pure. Relative imports within this directory are the whole permitted set.
    const offenders: string[] = [];
    for (const file of Object.keys(SEAL.files)) {
      const src = readFileSync(path.join(HERE, file), "utf8");
      for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
        const spec = m[1];
        const local = spec.startsWith("./") || spec.startsWith("../");
        // "../" would climb OUT of the sealed directory — also forbidden.
        if (!local || spec.startsWith("../")) offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(
      offenders,
      `ByteAudit must not depend on the code it audits:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("is imported by nothing that could rewrite it", () => {
    // ByteAudit may be READ by the publish path. Nothing may write to it, and in
    // particular the seal generator lives outside src/ so application code has no
    // route to regenerate the manifest.
    for (const file of Object.keys(SEAL.files)) {
      const src = readFileSync(path.join(HERE, file), "utf8");
      expect(src, `${file} must not write to the filesystem`).not.toMatch(
        /writeFileSync|createWriteStream|fs\.promises\.write/
      );
    }
  });
});

describe("the contract", () => {
  it("states enough steps to be a real check", () => {
    expect(PIPELINE_STEPS.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every step evidence and a consequence", () => {
    for (const s of PIPELINE_STEPS) {
      expect(s.promise.length, s.id).toBeGreaterThan(20);
      expect(s.evidence.length, s.id).toBeGreaterThan(20);
      // The sentence a person reads on a refusal. It has to say what is wrong
      // with their record, not name a rule.
      expect(s.ifAbsent.length, s.id).toBeGreaterThan(30);
    }
  });

  it("keeps step ids unique", () => {
    expect(new Set(PIPELINE_STEPS.map((s) => s.id)).size).toBe(PIPELINE_STEPS.length);
  });

  it("says out loud what it cannot do", () => {
    expect(LIMITS.length).toBeGreaterThanOrEqual(4);
    // A backstop trusted beyond its evidence converts "nobody checked" into
    // "something checked and said it was fine", which is worse than no backstop.
    expect(LIMITS.join(" ")).toMatch(/clinical/i);
  });
});

// A well-formed artifact, built by hand rather than by calling the app's
// composer — for the same reason the verifier does not import it.
const STAMP = [
  "",
  "---",
  "",
  "## Submission record",
  "",
  "- Ticket: DN-000123",
  "- Submitted by: Casey Rivera (crivera)",
  "- Submitted (US Eastern): 2026-08-05 14:22 EDT",
  "- Ruleset version: 2.21.0",
  "- Audit status at submission: AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED",
  "",
  "This entry may form part of a legal and medical record."
].join("\n");

function artifact(over: Partial<FinalArtifact> = {}): FinalArtifact {
  return {
    claimed: {
      ticket: "DN-000123",
      ruleVersion: "2.21.0",
      auditStatus: "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED",
      submittedAtEt: "2026-08-05 14:22 EDT",
      submissionId: 123
    },
    frozenNote: `# De-identified Smile Note draft\n\nComposite placed on tooth 30.\n${STAMP}`,
    frozenAudit: `# Audit report\n\n- Audit version: deterministic-checker 2.21.0\n- Status: AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED\n${STAMP}`,
    ...over
  };
}

describe("the verdict", () => {
  it("passes a well-formed artifact", () => {
    const v = byteAuditVerify(artifact());
    expect(v.publish, explainVerdict(v)).toBe(true);
    expect(v.objections).toEqual([]);
  });

  it("ran every step it promised to run", () => {
    // A verifier that silently skipped half its checks and returned "publish" is
    // the failure this whole component exists to prevent, so the count is part of
    // the verdict rather than an implementation detail.
    const v = byteAuditVerify(artifact());
    expect(v.stepsChecked).toBe(v.stepsExpected);
    expect(v.stepsExpected).toBe(PIPELINE_STEPS.length);
  });

  it("refuses a ticket that does not match its record number", () => {
    const v = byteAuditVerify(artifact({ claimed: { ...artifact().claimed, submissionId: 999 } }));
    expect(v.publish).toBe(false);
  });

  it("refuses when the note and the report carry different tickets", () => {
    const v = byteAuditVerify(
      artifact({ frozenAudit: artifact().frozenAudit.replace("DN-000123", "DN-000124") })
    );
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "ticket-agrees")).toBe(true);
  });

  it("refuses a torn write that left a ticket pointing at no note", () => {
    expect(byteAuditVerify(artifact({ frozenNote: "" })).publish).toBe(false);
    expect(byteAuditVerify(artifact({ frozenAudit: "   " })).publish).toBe(false);
  });

  it("refuses when the record and the document disagree about the outcome", () => {
    const a = artifact();
    const v = byteAuditVerify({
      ...a,
      claimed: { ...a.claimed, auditStatus: "READY FOR CLINICIAN REVIEW" }
    });
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "status-agrees")).toBe(true);
  });

  it("refuses a status it does not recognise", () => {
    const a = artifact();
    const v = byteAuditVerify({
      ...a,
      claimed: { ...a.claimed, auditStatus: "PROBABLY FINE" },
      frozenNote: a.frozenNote.replace(
        "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED",
        "PROBABLY FINE"
      )
    });
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "status-known")).toBe(true);
  });

  it("refuses a BLOCKED note that carries no attestation", () => {
    const a = artifact();
    const v = byteAuditVerify({
      ...a,
      claimed: { ...a.claimed, auditStatus: "BLOCKED" },
      frozenNote: a.frozenNote.replace("AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED", "BLOCKED")
    });
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "gate-honoured")).toBe(true);
  });

  it("refuses an override that names neither reason nor attestor", () => {
    const a = artifact();
    const v = byteAuditVerify({
      ...a,
      frozenAudit: a.frozenAudit.replace(
        "# Audit report",
        "# Audit report\n\n## Privacy stops overridden by attestation\n"
      )
    });
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "attestation-complete")).toBe(true);
  });

  it("refuses a ruleset stamp that disagrees with the record", () => {
    const v = byteAuditVerify(
      artifact({ claimed: { ...artifact().claimed, ruleVersion: "9.9.9" } })
    );
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "ruleset-stamped")).toBe(true);
  });

  it("refuses a malformed Eastern timestamp", () => {
    const a = artifact();
    const v = byteAuditVerify({
      ...a,
      claimed: { ...a.claimed, submittedAtEt: "2026-08-05T18:22:00Z" },
      frozenNote: a.frozenNote.replace("2026-08-05 14:22 EDT", "2026-08-05T18:22:00Z")
    });
    expect(v.publish).toBe(false);
    expect(v.objections.some((o) => o.stepId === "time-stamped")).toBe(true);
  });

  it("is deterministic — the same artifact always gets the same verdict", () => {
    // The property that makes a filed record re-verifiable years later, and the
    // reason this is not a model.
    const a = artifact();
    const runs = Array.from({ length: 5 }, () => JSON.stringify(byteAuditVerify(a)));
    expect(new Set(runs).size).toBe(1);
  });

  it("always carries its limits, even on a pass", () => {
    expect(byteAuditVerify(artifact()).limits).toEqual(LIMITS);
  });

  it("knows the four outcomes and nothing else", () => {
    expect(KNOWN_STATUSES).toHaveLength(4);
  });
});
