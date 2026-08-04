import { describe, expect, it } from "vitest";
import { measureBenchmarks } from "./benchmarks";
import { instrumentObservations } from "./instrument";

describe("instrument observations — language feedback without the model", () => {
  it("flags passive voice gaps objectively", () => {
    const report = measureBenchmarks("The crown was cemented. Instructions were given.");
    const obs = instrumentObservations(report);
    expect(obs.some((o) => o.kind === "active-voice")).toBe(true);
    expect(obs[0].source.length).toBeGreaterThan(5);
  });

  it("asks TN gap questions when cues are missing", () => {
    const report = measureBenchmarks("#14 MOD composite placed by the dentist.");
    const obs = instrumentObservations(report);
    expect(obs.some((o) => o.kind === "tn-required" && o.question?.includes("?"))).toBe(true);
  });

  it("returns at most three readings", () => {
    const report = measureBenchmarks("The tooth was extracted.");
    expect(instrumentObservations(report).length).toBeLessThanOrEqual(3);
  });

  it("stays quiet when everything is on target", () => {
    const report = measureBenchmarks(
      "The dentist cemented the crown. NKDA verified. Patient consented. Post-op instructions given. Recall 6 months."
    );
    const away = report.readings.filter((r) => r.direction === "away");
    if (away.length === 0) {
      expect(instrumentObservations(report).length).toBe(0);
    }
  });
});
