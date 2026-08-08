import { describe, expect, it } from "vitest";
import { builderFinishLine } from "./finishLine";

describe("builderFinishLine — first-impression finish control", () => {
  const ready = {
    hasContent: true,
    filingAllowed: true,
    exportAllowed: true,
    emailAllowed: true,
    blockedReason: null as string | null
  };

  it("asks for content before anything else", () => {
    expect(builderFinishLine({ ...ready, hasContent: false })).toMatch(/Write something/i);
  });

  it("names dentist filing before claiming Ready when authority is missing", () => {
    const line = builderFinishLine({ ...ready, filingAllowed: false });
    expect(line).toMatch(/Dentist must file/i);
    expect(line).not.toMatch(/Ready/i);
  });

  it("prefers filing authority over a cleared audit (no false green)", () => {
    // Hygienist cleared stops but note still needs dentist filing.
    expect(
      builderFinishLine({
        ...ready,
        filingAllowed: false,
        emailAllowed: true,
        exportAllowed: true
      })
    ).toMatch(/transfer ownership/i);
  });

  it("surfaces the blocked reason when export is locked", () => {
    expect(
      builderFinishLine({
        ...ready,
        exportAllowed: false,
        emailAllowed: false,
        blockedReason: "1 required field still open."
      })
    ).toBe("1 required field still open.");
  });

  it("says Ready only when content, filing, and email gates all clear", () => {
    expect(builderFinishLine(ready)).toBe("Ready to file.");
  });

  it("never says Ready when killers require ack (Honest Finish co-design)", () => {
    const line = builderFinishLine({ ...ready, requiresKillerAck: true });
    expect(line).toMatch(/Unresolved risk/i);
    expect(line).not.toMatch(/Ready/i);
  });

  it("never says Ready when open S2 reviews remain", () => {
    const line = builderFinishLine({ ...ready, openReviewCount: 2 });
    expect(line).toMatch(/Review open items/i);
    expect(line).toMatch(/Copy still allowed/i);
    expect(line).not.toMatch(/Ready/i);
  });

  it("blocks Copy/File messaging when clinical role is unset", () => {
    const line = builderFinishLine({ ...ready, roleRecorded: false });
    expect(line).toMatch(/clinical role/i);
    expect(line).not.toMatch(/Ready/i);
  });
});
