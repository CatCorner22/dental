import { describe, expect, it } from "vitest";
import { standardize } from "./standardize";
import {
  andon,
  blockedExplanation,
  buildConcerns,
  copyAllowed,
  isValidAttestation,
  openBlocking,
  reconcile,
  resolveItem,
  type FindingLike,
  type QueueItem
} from "./resolution";

const finding = (over: Partial<FindingLike> = {}): FindingLike => ({
  ruleId: "vague.tolerated-well",
  category: "vague-phrase",
  severity: "S2",
  message: '"tolerated well" is vague.',
  matchedText: "tolerated well",
  occurrences: 1,
  suggestion: "State the observed response.",
  ...over
});

function items(concerns = buildConcerns(standardize("Pt tolerated tx well"), [finding()])): QueueItem[] {
  return reconcile([], concerns);
}

describe("buildConcerns", () => {
  it("every applied change becomes a blocking review item — nothing is silently accepted", () => {
    const r = standardize("pt reports pain. tx discussed.");
    const concerns = buildConcerns(r, []);
    const changes = concerns.filter((c) => c.source === "change");
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      expect(c.blocking).toBe(true);
      expect(c.attestable).toBe(false);
    }
  });

  it("a truncation can never be attested or escalated — text was lost", () => {
    const long = "word ".repeat(5000);
    const r = standardize(long);
    const concerns = buildConcerns(r, []);
    const trunc = concerns.find((c) => c.key.startsWith("flag:truncated"));
    expect(trunc).toBeDefined();
    expect(trunc?.attestable).toBe(false);
    expect(trunc?.escalatable).toBe(false);
    expect(trunc?.severity).toBe("S0");
  });

  it("a PHI finding is never escalatable — the fragment must not travel", () => {
    const concerns = buildConcerns(standardize("clean text"), [
      finding({ ruleId: "phi.name", category: "phi", severity: "S0", message: "Possible name." })
    ]);
    const phi = concerns.find((c) => c.ruleId === "phi.name");
    expect(phi?.escalatable).toBe(false);
    expect(phi?.attestable).toBe(false);
  });

  it("S3/S4 findings inform but do not block", () => {
    const concerns = buildConcerns(standardize("clean text"), [
      finding({ severity: "S3" }),
      finding({ severity: "S4", ruleId: "info.x" })
    ]);
    expect(concerns.every((c) => c.source !== "finding" || !c.blocking)).toBe(true);
  });

  it("states what, why, and how for every concern", () => {
    for (const c of items().map((i) => i.concern)) {
      expect(c.what.length, c.key).toBeGreaterThan(3);
      expect(c.why.length, c.key).toBeGreaterThan(10);
      expect(c.how.length, c.key).toBeGreaterThan(10);
    }
  });
});

describe("reconcile across re-runs", () => {
  it("a concern that disappeared was fixed; one that persists keeps its state", () => {
    const first = items();
    const attestedKey = first.find((i) => i.concern.source === "finding")!.concern.key;
    const after = resolveItem(first, attestedKey, {
      kind: "attested",
      reason: "the response is documented in the vitals block"
    });

    // Re-run: the finding persists, the flags/changes are gone (user rewrote).
    const nextConcerns = buildConcerns(standardize("Patient tolerated treatment well"), [finding()]);
    const merged = reconcile(after, nextConcerns);
    const persisted = merged.find((i) => i.concern.key === attestedKey);
    expect(persisted?.state.kind).toBe("attested");
    // Old change-items are not in the new queue at all.
    for (const i of merged) {
      expect(nextConcerns.some((c) => c.key === i.concern.key)).toBe(true);
    }
  });
});

describe("gates", () => {
  it("copy is blocked while anything blocking is open", () => {
    const q = items();
    expect(copyAllowed(q)).toBe(false);
    expect(blockedExplanation(q)).toMatch(/unresolved/);
    expect(blockedExplanation(q)).toMatch(/fix|attest|Team Lead/i);
  });

  it("copy unlocks when every blocking item is resolved", () => {
    let q = items();
    for (const i of openBlocking(q)) {
      q = resolveItem(
        q,
        i.concern.key,
        i.concern.source === "change"
          ? { kind: "reviewed" }
          : { kind: "attested", reason: "verified correct against the source record" }
      );
    }
    expect(copyAllowed(q)).toBe(true);
    expect(blockedExplanation(q)).toBe("");
  });

  it("an escalation resolves the item — the disagreement is on record, not overridden", () => {
    let q = items();
    for (const i of openBlocking(q)) {
      q = resolveItem(
        q,
        i.concern.key,
        i.concern.source === "change" ? { kind: "reviewed" } : { kind: "escalated", wishId: 12 }
      );
    }
    expect(copyAllowed(q)).toBe(true);
  });
});

describe("andon", () => {
  it("red while S1+ open, amber for S2-only, green when clear", () => {
    const q = items();
    expect(andon(q).state).toBe("red"); // flags sit at S1
    // resolve everything except the S2 finding
    let amberQ = q;
    for (const i of openBlocking(q)) {
      if (i.concern.source === "finding") continue;
      amberQ = resolveItem(
        amberQ,
        i.concern.key,
        i.concern.source === "change"
          ? { kind: "reviewed" }
          : { kind: "attested", reason: "verified correct against the source record" }
      );
    }
    expect(andon(amberQ).state).toBe("amber");
    let greenQ = amberQ;
    for (const i of openBlocking(amberQ)) {
      greenQ = resolveItem(greenQ, i.concern.key, {
        kind: "attested",
        reason: "verified correct against the source record"
      });
    }
    expect(andon(greenQ).state).toBe("green");
  });
});

describe("attestation substance", () => {
  it("shares the PHI bar: real words, not filler", () => {
    expect(isValidAttestation("ok")).toBe(false);
    expect(isValidAttestation("asdf asdf asdf asdf asdf")).toBe(false);
    expect(isValidAttestation("the response is recorded in the vitals block")).toBe(true);
  });
});
