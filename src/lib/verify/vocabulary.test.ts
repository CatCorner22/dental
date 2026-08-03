import { describe, expect, it } from "vitest";
import {
  EVER_LICENSABLE_STEMS,
  LOADED_ASSERTIONS,
  SOAP_HEADINGS,
  SYNTACTIC_STEMS,
  licenseFor
} from "./vocabulary";
import { PLANTABLE_ENTITIES } from "./grounding";
import { canonical, clauses, stem, words } from "./normalize";
import { SYSTEM_PROMPTS } from "@/lib/assist/prompts";
import { MEDICATION_WORDS } from "@/lib/vocab/misspellings";

// The grounding check has exactly one escape hatch — PERMITTED_STEMS, the
// practice's own standard vocabulary — and the last surviving red-team attack
// went straight through it. "amoxicillin" was permitted because the misspellings
// table corrects TO it, so a model could ask "Was the amoxicillin course
// completed?" about a note that said only "an antibiotic", and the word counted
// as standard vocabulary rather than as a planted drug.
//
// That was not a coding mistake so much as a structural one: the allowlist is
// DERIVED from four living tables, so anyone adding an entry to any of them can
// widen it without ever opening this directory. These tests are the wall against
// that. They assert relationships between the sets rather than their contents,
// which is what lets the tables keep growing safely.

describe("nothing clinical is permitted UNCONDITIONALLY", () => {
  // Only grammar is. Every clinical word has to be earned, either by appearing in
  // the note or by being the consequence of a standardization the note triggers.

  it("licenses a drug name ONLY from a curated abbreviation of that same drug", () => {
    // The rule this replaced was "no rule may ever license a drug name", and it
    // was too blunt in one direction and exactly right in the other.
    //
    // Wrong: "epi" IS epinephrine, abbreviated by the writer. Spelling it out is
    // what a documentation standardizer is for, and it is safer than leaving
    // three letters where a vasoconstrictor should be named — an anaesthetic
    // record that hides its agent is the problem, not the fix.
    //
    // Right: a SPELLING CORRECTION licensing a drug name is a guess about which
    // drug was meant, and the practice's rule is that such a guess waits for a
    // clinician. That half is asserted separately below.
    //
    // So the enforceable invariant is that the licensing list is CURATED: adding
    // a drug to it fails this test, which makes it a deliberate act a reviewer
    // sees rather than a side effect of editing a vocabulary table.
    const licensable = [...MEDICATION_WORDS]
      .filter((drug) => EVER_LICENSABLE_STEMS.has(stem(drug)))
      .sort();
    expect(licensable).toEqual(["epinephrine", "fluoride", "lidocaine"]);
  });

  it("never licenses a drug name from a spelling correction", () => {
    // "amoxicilin" is almost certainly amoxicillin, and "almost certainly" is not
    // a standard a drug name may be corrected on.
    expect(licenseFor("Prescribed amoxicilin 500 mg.").licensed.has(stem("amoxicillin"))).toBe(false);
  });

  it("expanding one drug abbreviation does not license a SECOND drug", () => {
    // The attack the loosened rule could have opened: the note abbreviates one
    // agent, and the model quietly adds another alongside it.
    const license = licenseFor("2 carpules lido used.");
    expect(license.licensed.has(stem("lidocaine"))).toBe(true);
    expect(license.licensed.has(stem("epinephrine"))).toBe(false);
  });

  it("permits no medication name unconditionally", () => {
    expect([...MEDICATION_WORDS].filter((d) => SYNTACTIC_STEMS.has(stem(d)))).toEqual([]);
  });

  it("never unconditionally permits something a question may not plant", () => {
    expect([...PLANTABLE_ENTITIES].filter((s) => SYNTACTIC_STEMS.has(s))).toEqual([]);
  });

  it("never unconditionally permits a loaded assertion", () => {
    // The ten-hole test. A flat allowlist made "reviewed", "verified", "checked",
    // "examined", "observed", "allergy", "scaling", "probing", "signs" and
    // "limits" free for a model to assert, because somewhere in the tables a rule
    // expands to each. They are still reachable — but only from their own
    // trigger, which is the next test.
    expect([...LOADED_ASSERTIONS].filter((s) => SYNTACTIC_STEMS.has(s))).toEqual([]);
  });
});

describe("a standardization is licensed by its trigger and nothing else", () => {
  it("licenses the replacement the audit engine is demanding at that moment", () => {
    // "x-ray" -> "radiograph" is an edit the abbreviation rule asks for while the
    // writer is still typing. A verifier that refused it would refuse the
    // transformer's own correct output.
    expect(licenseFor("X-ray taken of tooth 14.").licensed.has(stem("radiograph"))).toBe(true);
  });

  it("does NOT license that replacement for a note that never triggered it", () => {
    expect(licenseFor("Composite placed on tooth 19.").licensed.has(stem("radiograph"))).toBe(false);
  });

  it("lets NKA expand, and only for a note that says NKA", () => {
    expect(licenseFor("NKA. Prophylaxis completed.").licensed.has(stem("allergies"))).toBe(true);
    expect(licenseFor("Prophylaxis completed.").licensed.has(stem("allergies"))).toBe(false);
  });

  it("permits ordinary grammar always", () => {
    const { licensed } = licenseFor("");
    for (const w of ["the", "was", "with", "and", "of", "were", "in"]) {
      expect(licensed.has(stem(w)), w).toBe(true);
    }
  });

  it("permits the SOAP headings the structure prompt asks the model to emit", () => {
    // Derived from the same list, so a heading rename cannot leave the verifier
    // refusing the output its own prompt requested.
    const { licensed } = licenseFor("");
    for (const heading of SOAP_HEADINGS) {
      expect(licensed.has(stem(heading)), heading).toBe(true);
      expect(SYSTEM_PROMPTS.soap.toLowerCase()).toContain(heading);
    }
  });
});

describe("digit folding", () => {
  // Pinned because the first implementation rewrote every ASCII digit to "0" and
  // nothing noticed: input and output were corrupted identically, so every
  // comparison still agreed and only the numbers printed back to a clinician
  // were wrong.
  it("leaves ASCII digits alone", () => {
    expect(canonical("Probing depths 3, 4, and 19 mm on tooth 30.")).toContain("3, 4, and 19");
    expect(canonical("500")).toBe("500");
    expect(canonical("0")).toBe("0");
    expect(canonical("1024")).toBe("1024");
  });

  it("folds other decimal scripts onto ASCII", () => {
    expect(canonical("\u0665\u0660\u0660")).toBe("500"); // Arabic-Indic
    expect(canonical("\uFF11\uFF19")).toBe("19"); // fullwidth, via NFKC
    expect(canonical("\u096F")).toBe("9"); // Devanagari nine
    expect(canonical("\u0E55")).toBe("5"); // Thai five
  });

  it("strips the invisible characters a denylist would keep missing", () => {
    expect(canonical("50\u200B0")).toBe("500");
  });
});

describe("clause splitting", () => {
  it("separates independent assertions so a negation cannot be read across them", () => {
    expect(clauses("No swelling; tenderness present.")).toEqual([
      "No swelling",
      "tenderness present."
    ]);
  });

  it("splits on sentence boundaries", () => {
    expect(clauses("Tooth 19 restored. 2 carpules used.")).toEqual([
      "Tooth 19 restored.",
      "2 carpules used."
    ]);
  });
});

describe("stemming", () => {
  it("brings inflections of the same word together", () => {
    expect(stem("restored")).toBe(stem("restore"));
    expect(stem("restoration")).toBe(stem("restore"));
    expect(stem("carpules")).toBe(stem("carpule"));
    expect(stem("reports")).toBe(stem("report"));
  });

  it("does not collapse different clinical words", () => {
    expect(stem("mesial")).not.toBe(stem("distal"));
    expect(stem("consent")).not.toBe(stem("consult"));
    expect(words("MOD composite")).toEqual(["mod", "composite"]);
  });
});
