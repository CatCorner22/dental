import { describe, expect, it } from "vitest";
import {
  detectForeignJurisdiction,
  hasStrongClaim,
  isRegulatorySource,
  isTennesseeSource,
  resolveModes,
  resolveProfile,
  strictPromptAddendum
} from "./router";
import { runByteStar } from "./service";
import type { GenerateListFn } from "@/lib/assist/service";

// FROZEN ROUTING CASES — the router is deterministic, so the bar is 100%.
// A failed case means the cues moved; move them back or freeze new gold.
const ROUTING_CASES: Array<{ id: string; text: string; expect: string[] }> = [
  {
    id: "route.plain-operative",
    text: "Tooth 14 MOD composite placed by the dentist. 2 carpules lidocaine 2% with epinephrine.",
    expect: ["documentation"]
  },
  {
    id: "route.sedation-nitrous",
    text: "Nitrous oxide at 30%; NPO confirmed; recovered on oxygen.",
    expect: ["documentation", "sedation"]
  },
  {
    id: "route.sedation-mgkg",
    text: "Dose held under the 4.4 mg/kg ceiling for the visit.",
    expect: ["documentation", "sedation"]
  },
  {
    id: "route.imaging-bitewings",
    text: "Four bitewing radiographs acquired; interpretation recorded by the dentist.",
    expect: ["documentation", "imaging"]
  },
  {
    id: "route.imaging-cbct",
    text: "CBCT reviewed for implant planning of site 30.",
    expect: ["documentation", "imaging"]
  },
  {
    id: "route.legal-supervision",
    text: "Hygiene visit completed under general supervision per licensure.",
    expect: ["documentation", "legal"]
  },
  {
    id: "route.legal-scope",
    text: "Scope of practice question raised about coronal polishing.",
    expect: ["documentation", "legal"]
  },
  {
    id: "route.sedation-plus-imaging",
    text: "Panoramic radiograph reviewed before moderate sedation planning; NPO instructions given.",
    expect: ["documentation", "sedation", "imaging"]
  }
];

describe("SuperByte mode router (deterministic)", () => {
  it("routes every frozen case exactly", () => {
    for (const c of ROUTING_CASES) {
      expect(resolveModes(c.text), c.id).toEqual(c.expect);
    }
  });

  it("routine local anesthetic does not trip sedation mode", () => {
    const modes = resolveModes("2 carpules lidocaine 2% with 1:100,000 epinephrine administered.");
    expect(modes).toEqual(["documentation"]);
  });

  it("documentation profile allows rewrites and majority consensus", () => {
    const p = resolveProfile(["documentation"]);
    expect(p.id).toBe("documentation");
    expect(p.forbidRewrites).toBe(false);
    expect(p.unanimous).toBe(false);
  });

  it("single high-risk mode gets unanimous reads and no rewrites", () => {
    const p = resolveProfile(["documentation", "sedation"]);
    expect(p.id).toBe("high-risk");
    expect(p.unanimous).toBe(true);
    expect(p.forbidRewrites).toBe(true);
    expect(p.minReads).toBe(3);
  });

  it("legal mode — and any two high-risk modes — escalate to the legal profile", () => {
    expect(resolveProfile(["documentation", "legal"]).id).toBe("legal");
    expect(resolveProfile(["documentation", "sedation", "imaging"]).id).toBe("legal");
    expect(resolveProfile(["documentation", "legal"]).regulatorySourcesOnly).toBe(true);
  });

  it("strict addendum exists for strict profiles only", () => {
    expect(strictPromptAddendum(resolveProfile(["documentation"]), ["documentation"])).toBe("");
    const strict = strictPromptAddendum(resolveProfile(["documentation", "sedation"]), [
      "documentation",
      "sedation"
    ]);
    expect(strict).toMatch(/STRICT READ/);
    expect(strict).toMatch(/sedation/);
  });

  it("detects a foreign jurisdiction only with a legal cue present", () => {
    expect(
      detectForeignJurisdiction("Patient moving; asked about Georgia licensure rules for records.")
    ).toBe("Georgia");
    // State word without legal context: not a jurisdiction question.
    expect(detectForeignJurisdiction("Georgia peach flavoring on the fluoride varnish.")).toBeNull();
    // Tennessee itself is never foreign.
    expect(detectForeignJurisdiction("Tennessee law requires a treatment record.")).toBeNull();
  });

  it("labels strong claims and recognizes regulatory sources", () => {
    expect(hasStrongClaim("This must be documented.", "")).toBe(true);
    expect(hasStrongClaim("Consider naming the actor.", "The sentence is passive.")).toBe(false);
    expect(isRegulatorySource("TN Board of Dentistry Rules 0460-02")).toBe(true);
    expect(isRegulatorySource("Practice writing standard — active voice")).toBe(false);
    expect(isTennesseeSource("TN Board of Dentistry")).toBe(true);
    expect(isTennesseeSource("ADA glossary")).toBe(false);
  });
});

// Adversary bindings — prove the profile is ENFORCED, not requested.
const CONFIG = {
  enabled: true,
  model: "test",
  silentlyKilled: false,
  assistOn: true,
  pioneerOptedOut: false
};

function modelReturning(suggestions: unknown[]): GenerateListFn {
  return async () => ({ suggestions });
}

describe("strict profiles are enforced by the verifier", () => {
  it("refuses a rewrite in sedation-strict mode", async () => {
    const sedationDraft =
      "Nitrous oxide at 30% with SpO2 monitoring. NPO confirmed. The patient was dismissed after recovery.";
    const adversary = modelReturning([
      {
        kind: "active-voice",
        say: "A passive construction hides the actor.",
        why: "The record should name who dismissed the patient.",
        evidence: "The patient was dismissed",
        rewrite: "The assistant dismissed the patient after recovery.",
        source: "Practice writing standard"
      }
    ]);
    const outcome = await runByteStar(sedationDraft, adversary, { config: CONFIG, reads: 1 });
    // Strict profile raises reads to 3; identical output reaches consensus,
    // then the rewrite is refused by code, not by asking nicely.
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("verifier-rejected");
      expect(outcome.codes).toContain("rewrite-in-strict-mode");
    }
  });

  it("legal profile refuses house-style sources", async () => {
    const legalDraft =
      "Hygiene visit completed under general supervision per licensure. Coronal polishing performed.";
    const adversary = modelReturning([
      {
        kind: "clarity",
        say: "The supervision statement could name the supervising dentist's role.",
        why: "Reviewers look for the responsible dentist.",
        evidence: "under general supervision",
        source: "Practice writing standard"
      }
    ]);
    const outcome = await runByteStar(legalDraft, adversary, { config: CONFIG, reads: 1 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.codes).toContain("source-not-regulatory");
  });

  it("withholds TN-sourced observations for a foreign jurisdiction", async () => {
    const foreignDraft =
      "Patient relocating; question about Georgia licensure rules for transferring records.";
    const adversary = modelReturning([
      {
        kind: "tn-required",
        say: "Is the record transfer documented?",
        why: "Transfers need a documented request.",
        question: "Was the records request documented?",
        source: "TN Board of Dentistry Rules"
      }
    ]);
    const outcome = await runByteStar(foreignDraft, adversary, { config: CONFIG, reads: 1 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.codes).toContain("out-of-jurisdiction");
  });

  it("labels a strong claim without named authority as tentative — by code", async () => {
    const plainDraft =
      "Tooth 14 MOD composite placed by the dentist. Occlusion checked and adjusted.";
    const adversary = modelReturning([
      {
        kind: "clarity",
        say: "The shade selection must be documented.",
        why: "Shade is part of the restorative record.",
        evidence: "MOD composite placed",
        source: "Curve Hero paste conventions"
      }
    ]);
    const outcome = await runByteStar(plainDraft, adversary, { config: CONFIG, reads: 1 });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.profile).toBe("documentation");
      expect(outcome.suggestions[0]?.tentative).toBe(true);
      expect(outcome.codes).toContain("tentative-strong-claim");
    }
  });

  it("stamps modes and profile onto the ok outcome", async () => {
    const adversary = modelReturning([
      {
        kind: "completeness",
        say: "Was a follow-up interval documented?",
        why: "Recall closes the loop.",
        question: "Was a follow-up interval documented?",
        source: "TN Board of Dentistry Rules"
      }
    ]);
    const outcome = await runByteStar(
      "Four bitewing radiographs acquired; interpretation recorded by the dentist.",
      adversary,
      { config: CONFIG, reads: 1 }
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.modes).toContain("imaging");
      expect(outcome.profile).toBe("high-risk");
      expect(outcome.reads).toBe(3);
    }
  });
});
