import { describe, expect, it } from "vitest";
import { superbyteLayerLabel, superbyteLiveStatus } from "./liveStatus";

describe("SuperByte live status (HF MessageUpdate-style present tense)", () => {
  const base = {
    draftLen: 80,
    minChars: 24,
    deploy: "on" as const,
    observing: false,
    feedbackSource: null as const,
    observationCount: 0
  };

  it("names waiting when the draft is empty", () => {
    expect(superbyteLiveStatus({ ...base, draftLen: 0 })).toMatch(/Waiting/i);
  });

  it("names an in-flight read before observations land", () => {
    expect(superbyteLiveStatus({ ...base, observing: true })).toMatch(/Reading/i);
  });

  it("distinguishes pioneer from instrument after a read", () => {
    expect(
      superbyteLiveStatus({
        ...base,
        feedbackSource: "pioneer",
        observationCount: 2
      })
    ).toMatch(/Pioneer/i);
    expect(
      superbyteLiveStatus({
        ...base,
        feedbackSource: "instrument",
        observationCount: 2
      })
    ).toMatch(/instrument/i);
  });

  it("states pioneer-dark without claiming gauges are dead", () => {
    expect(superbyteLiveStatus({ ...base, deploy: "off" })).toMatch(/gauges still run/i);
  });
});

describe("SuperByte layer label (HF RouterMetadata-style)", () => {
  it("surfaces Reading while a pioneer call is in flight", () => {
    expect(superbyteLayerLabel(null, true, "on")).toEqual({
      label: "Reading",
      tone: "reading"
    });
  });

  it("names the speaking layer once observations exist", () => {
    expect(superbyteLayerLabel("pioneer", false, "on").label).toBe("Pioneer");
    expect(superbyteLayerLabel("instrument", false, "on").label).toBe("Instrument");
  });

  it("names Pioneer dark when the deployment door is closed", () => {
    expect(superbyteLayerLabel(null, false, "off").tone).toBe("dark");
  });
});
