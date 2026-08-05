import { describe, expect, it } from "vitest";
import { LOADED_PHRASES, screenLoadedPhrases } from "./loaded-phrases";
import { KNOWLEDGE } from "@/lib/advisor/knowledge";
import { measureBenchmarks } from "@/lib/bytestar/benchmarks";
import { instrumentObservations } from "@/lib/bytestar/instrument";
import { BYTESTAR_SYSTEM_PROMPT } from "@/lib/bytestar/prompts";
import { BYTESTAR_UNAVAILABLE } from "@/lib/bytestar/config";
import { BYTESTAR_ONE_WAY_NOTICE } from "@/lib/bytestar/one-way";
import { SEVERITY_LABELS, SEVERITY_MEANING } from "@/lib/audit/types";

// LANGUAGE VIGILANCE — the app's own voice is held to the practice's
// language standard, in CI, permanently.
//
// The advisors now generate staff-facing language at scale: coaching text,
// gauge notes, instrument readings, a system prompt that shapes model output.
// A one-time manual review of that copy decays the day the next entry is
// added; this suite is the durable version. Every staff-facing string the
// advisor layer ships is screened against the loaded-phrase catalog, so a
// future contribution containing "grandfathered" or "blind spot's" cousins
// fails the build with the alternatives printed in the failure message.
//
// DELIBERATE EXCLUSIONS, with reasons:
// - The SuperByte disclaimer is the owner's commissioned copy, verbatim by
//   contract (a pinned test enforces the exact text). It is screened here
//   too — it currently passes — but if the catalog ever grows to flag it,
//   the OWNER decides, not this suite. The assertion is therefore soft:
//   it reports rather than mutates.
// - Note TEXT written by staff is never screened by this catalog. The
//   effort/tone audit rules cover patient-directed insults; policing staff
//   idiom beyond that is explicitly out of scope ("flag options; do not
//   police staff or patients").

function expectClean(label: string, text: string) {
  const hits = screenLoadedPhrases(text);
  const detail = hits
    .map((id) => {
      const entry = LOADED_PHRASES.find((e) => e.id === id)!;
      return `${id} (${entry.why} Try: ${entry.alternatives.join(", ")})`;
    })
    .join("; ");
  expect(hits, `${label}: ${detail}`).toEqual([]);
}

describe("the catalog itself", () => {
  it("has unique ids and working patterns", () => {
    const ids = LOADED_PHRASES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screenLoadedPhrases("the request was grandfathered in")).toContain("grandfathered");
    expect(screenLoadedPhrases("add it to the whitelist")).toContain("blacklist-whitelist");
    expect(screenLoadedPhrases("this is crazy")).toContain("mental-state-slang");
    expect(screenLoadedPhrases("blind to the risk")).toContain("sensory-metaphors");
  });

  it("does not flag clinical terms of art or ordinary standalone words", () => {
    expect(screenLoadedPhrases("master apical file established at 21 mm")).toEqual([]);
    expect(screenLoadedPhrases("Master Chart Auditor rank achieved")).toEqual([]);
    expect(screenLoadedPhrases("the whiteboard in operatory two")).toEqual([]);
  });
});

describe("Byte's knowledge base speaks to the standard", () => {
  for (const entry of KNOWLEDGE) {
    it(`${entry.id} is clean`, () => {
      expectClean(entry.id, `${entry.say} ${entry.why} ${entry.source}`);
    });
  }
});

describe("SuperByte's voice speaks to the standard", () => {
  it("system prompt is clean", () => {
    expectClean("BYTESTAR_SYSTEM_PROMPT", BYTESTAR_SYSTEM_PROMPT);
  });

  it("unavailable copy and one-way notice are clean", () => {
    expectClean("BYTESTAR_UNAVAILABLE", BYTESTAR_UNAVAILABLE);
    expectClean("BYTESTAR_ONE_WAY_NOTICE", BYTESTAR_ONE_WAY_NOTICE);
  });
});

describe("gauge notes and instrument readings speak to the standard", () => {
  // Drive the generators across texts that exercise every note branch: empty,
  // sparse, passive-heavy, dense, complete. The strings are what staff read.
  const SAMPLES = [
    "",
    "#17 extracted.",
    "The crown was cemented. Instructions were given.",
    "#14 MOD composite placed by the dentist. NKDA. Patient consented. Post-op instructions given. Recall 6 months.",
    "word ".repeat(300)
  ];

  it("every benchmark label and note is clean across sample drafts", () => {
    for (const text of SAMPLES) {
      const report = measureBenchmarks(text);
      for (const reading of report.readings) {
        expectClean(`benchmark ${reading.id} label`, reading.label);
        expectClean(`benchmark ${reading.id} note`, reading.note);
      }
    }
  });

  it("every instrument observation is clean across sample drafts", () => {
    for (const text of SAMPLES) {
      const report = measureBenchmarks(text);
      for (const obs of instrumentObservations(report)) {
        expectClean(`instrument ${obs.kind}`, `${obs.say} ${obs.why} ${obs.question ?? ""} ${obs.source}`);
      }
    }
  });
});

describe("audit severity vocabulary speaks to the standard", () => {
  it("labels and meanings are clean", () => {
    for (const [k, v] of Object.entries(SEVERITY_LABELS)) expectClean(`label ${k}`, v);
    for (const [k, v] of Object.entries(SEVERITY_MEANING)) expectClean(`meaning ${k}`, v);
  });
});
