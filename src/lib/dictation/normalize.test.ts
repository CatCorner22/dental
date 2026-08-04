import { describe, expect, it } from "vitest";
import { normalizeDictation } from "./normalize";

// STORM FIRST (transformer discipline): casing variants, plurals, sentence
// boundaries, collision words, cross-line safety, idempotency ×3. This pass
// runs on DICTATED text before it lands in the input box — it may only join
// split dental terms, never expand, reword, or touch meaning.

describe("dictation normalization — what it fixes", () => {
  it("joins split radiograph terms", () => {
    expect(normalizeDictation("four bite wings taken").text).toBe("four bitewings taken");
    expect(normalizeDictation("one bite wing taken").text).toBe("one bitewing taken");
    expect(normalizeDictation("peri apical radiograph reviewed").text).toBe(
      "periapical radiograph reviewed"
    );
    expect(normalizeDictation("an x ray was acquired").text).toBe("an x-ray was acquired");
    expect(normalizeDictation("two x rays compared").text).toBe("two x-rays compared");
  });

  it("joins split anatomical and material terms", () => {
    expect(normalizeDictation("sub gingival calculus noted").text).toBe(
      "subgingival calculus noted"
    );
    expect(normalizeDictation("supra gingival plaque").text).toBe("supragingival plaque");
    expect(normalizeDictation("inter proximal contact checked").text).toBe(
      "interproximal contact checked"
    );
    expect(normalizeDictation("gutta percha placed").text).toBe("gutta-percha placed");
  });

  it("joins split peri-operative terms", () => {
    expect(normalizeDictation("post op instructions given").text).toBe(
      "post-op instructions given"
    );
    expect(normalizeDictation("post operative course reviewed").text).toBe(
      "postoperative course reviewed"
    );
    expect(normalizeDictation("pre op evaluation done").text).toBe("pre-op evaluation done");
    expect(normalizeDictation("pre operative fasting confirmed").text).toBe(
      "preoperative fasting confirmed"
    );
  });

  it("preserves the speaker's casing at the join", () => {
    expect(normalizeDictation("Bite wings taken").text).toBe("Bitewings taken");
    expect(normalizeDictation("X ray reviewed").text).toBe("X-ray reviewed");
    expect(normalizeDictation("POST OP instructions").text).toBe("POST-OP instructions");
  });

  it("reports what changed so the UI can say so", () => {
    const r = normalizeDictation("bite wing and x ray taken");
    expect(r.changes).toHaveLength(2);
    expect(r.changes[0]).toMatchObject({ from: "bite wing", to: "bitewing" });
  });
});

describe("dictation normalization — what it refuses to touch", () => {
  it("never joins across sentence punctuation", () => {
    // "…seated post. Op note follows." — the period is a boundary, not a split term.
    const input = "Core seated post. Op note follows.";
    expect(normalizeDictation(input).text).toBe(input);
  });

  it("never joins across line breaks", () => {
    const input = "post\nop";
    expect(normalizeDictation(input).text).toBe(input);
  });

  it("leaves collision words alone (word-boundary discipline)", () => {
    const frost = "frostbite wings observed on the hiking trip";
    expect(normalizeDictation(frost).text).toBe(frost);
    const compost = "compost operative at the community garden";
    expect(normalizeDictation(compost).text).toBe(compost);
  });

  it("never touches numbers, doses, teeth, or negations", () => {
    const clinical = "tooth 14 no swelling 2 carpules lidocaine 2% with epinephrine 4 mm pocket";
    expect(normalizeDictation(clinical).text).toBe(clinical);
  });

  it("leaves already-correct terms unchanged", () => {
    const good = "bitewings, periapical, x-ray, post-op, gutta-percha, subgingival";
    expect(normalizeDictation(good).text).toBe(good);
  });
});

describe("dictation normalization — idempotency ×3", () => {
  it("a second and third pass change nothing", () => {
    const input =
      "Bite wings and a peri apical x ray taken. Post op instructions given. Gutta percha placed sub gingival.";
    const once = normalizeDictation(input).text;
    const twice = normalizeDictation(once).text;
    const thrice = normalizeDictation(twice).text;
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
  });
});
