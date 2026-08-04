import { describe, expect, it } from "vitest";
import { runPhiRule } from "./phi";
import { runAssist, type GenerateFn } from "@/lib/assist/service";

// PHI EVASION RED TEAM.
//
// The premise on the front of the README is absolute: "No patient identifier
// ever enters this tool or any AI platform." A hostile read of the screen found
// two ways that sentence was not true, and they are different in kind.
//
// The first is a tokenizer problem. Every pattern in phi.ts is written with \d,
// which in JavaScript is ASCII-only, so an identifier typed in another decimal
// script or split by a zero-width character was invisible to the entire screen
// while reading normally to a human.
//
// The second is a threshold problem, and it was the more serious of the two: the
// AI gate filtered to S0, so a name the bare-name rule had correctly flagged at
// S2 was sent to a third-party provider anyway.

const ids = (text: string) => runPhiRule(text).map((f) => f.ruleId);
const rejectsAll: GenerateFn = async () => {
  throw new Error("the model must never be reached in these tests");
};

describe("digits in another script are no longer invisible", () => {
  it("catches a phone number in fullwidth digits", () => {
    // Reads as "865-555-1234" on screen. phi.phone never saw it.
    expect(ids("Call \uFF18\uFF16\uFF15-\uFF15\uFF15\uFF15-\uFF11\uFF12\uFF13\uFF14 to confirm.")).toContain(
      "phi.obfuscated-digits"
    );
  });

  it("catches an SSN in Arabic-Indic digits", () => {
    expect(ids("\u0661\u0662\u0663-\u0664\u0665-\u0666\u0667\u0668\u0669 on file.")).toContain(
      "phi.obfuscated-digits"
    );
  });

  it("catches a mixed-script number, not only one that starts non-ASCII", () => {
    // The leading \p{Nd}* has to backtrack to find a non-ASCII digit anywhere in
    // the run, or "12٣45" hides behind its own first character.
    expect(ids("Record 12\u0663 45.")).toContain("phi.obfuscated-digits");
  });

  it("catches Devanagari and Thai digits too, without naming them", () => {
    // \p{Nd} is the whole category, so no script list has to be maintained.
    expect(ids("Chart \u096F\u096F\u096F.")).toContain("phi.obfuscated-digits");
    expect(ids("Chart \u0E55\u0E55\u0E55.")).toContain("phi.obfuscated-digits");
  });

  it("says nothing about ordinary clinical numbers", () => {
    // The check has to be silent on every real note or it gets muted, and then
    // it protects nothing. This is the case that matters most for adoption.
    for (const text of [
      "Probing depths 3, 4, and 5 mm on tooth 30.",
      "Amoxicillin 500 mg three times daily for 7 days.",
      "MOD composite on tooth 19, 2 carpules of 4% articaine with 1:100,000 epinephrine.",
      "Blood pressure 128/76. Pulse 72."
    ]) {
      expect(ids(text), text).not.toContain("phi.obfuscated-digits");
    }
  });
});

describe("invisible characters are no longer a way through", () => {
  it("catches a zero-width space splitting a phone number", () => {
    // "865​-555-1234" — the ZWSP defeats every \b-anchored rule in phi.ts, and
    // the Mask button then has nothing to mask.
    const findings = ids("Call 865\u200B-555-1234 today.");
    expect(findings).toContain("phi.hidden-characters");
  });

  it("catches a zero-width joiner inside a nine-digit run", () => {
    expect(ids("123\u200D45\u200D6789")).toContain("phi.hidden-characters");
  });

  it("catches a name welded together by a zero-width space", () => {
    // Defeats NAME_PAIR, which requires contiguous whitespace between the two
    // words, so no name finding fired at all.
    expect(ids("John\u200BSmith presented for recall.")).toContain("phi.hidden-characters");
  });

  it("catches the TAG block, which encodes arbitrary ASCII invisibly", () => {
    expect(ids("Recall visit.\u{E0041}\u{E0042}")).toContain("phi.hidden-characters");
  });

  it("says nothing about an ordinary note", () => {
    expect(ids("Recall and prophylaxis completed. No acute findings.")).not.toContain(
      "phi.hidden-characters"
    );
  });
});

describe("the AI gate is stricter than the internal gate, on purpose", () => {
  // S2 REVIEW is right for a name heuristic INSIDE the tool: a human is about to
  // read it, and blocking the line on "Bradley County" costs more than it gains.
  // That reasoning collapses on this path, because the text is handed to a
  // third-party provider the instant the call is made and no later review can
  // recall it.

  it("refuses to send a bare name, which is only S2 internally", () => {
    const findings = runPhiRule("John Smith presented for recall.");
    // Confirm the premise of the test: this really is a non-blocking severity.
    expect(findings.every((f) => f.severity !== "S0")).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("blocks the call before the model is reached, for an S2-only finding", async () => {
    const out = await runAssist("normalize", "John Smith presented for recall.", rejectsAll);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("phi-blocked");
  });

  it("blocks an unpunctuated ten-digit phone, also only S2 internally", async () => {
    const out = await runAssist("normalize", "Call 8655551234 to confirm the recall.", rejectsAll);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("phi-blocked");
  });

  it("blocks obfuscated digits before they reach a provider", async () => {
    const out = await runAssist(
      "normalize",
      "Call \uFF18\uFF16\uFF15-\uFF15\uFF15\uFF15-\uFF11\uFF12\uFF13\uFF14 to confirm.",
      rejectsAll
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("phi-blocked");
  });

  it("explains that the bar for leaving the building is the lower one", async () => {
    // The message has to account for a stop the rest of the app calls a review,
    // or staff read it as the tool contradicting itself.
    const out = await runAssist("normalize", "John Smith presented for recall.", rejectsAll);
    if (!out.ok) expect(out.message).toMatch(/reviewed afterwards|outside provider/i);
  });

  it("still lets a genuinely de-identified note through", async () => {
    // The needle again: a gate nothing passes is a feature nobody uses.
    const model: GenerateFn = async () =>
      "The patient reports pain lasting 3 days. Tooth 19 was restored with 2 carpules of anesthetic.";
    const out = await runAssist(
      "normalize",
      "pt reports pain x3 days. tooth 19 restored, 2 carpules used for the anesthetic.",
      model
    );
    expect(out.ok).toBe(true);
  });
});
