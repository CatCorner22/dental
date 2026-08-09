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

  it("never says Ready when killers hard-block handoff", () => {
    const line = builderFinishLine({ ...ready, killersBlockHandoff: true });
    expect(line).toMatch(/Litigation-sensitive gaps block/i);
    expect(line).not.toMatch(/Ready/i);
    expect(line).toMatch(/no checkbox bypass/i);
  });

  it("never says Ready when open Soft S2 reviews remain", () => {
    const line = builderFinishLine({ ...ready, openReviewCount: 2 });
    expect(line).toMatch(/Open review items remain/i);
    expect(line).toMatch(/Copy does not clear them/i);
    expect(line).not.toMatch(/Ready/i);
  });

  it("blocks writing/Copy messaging when clinical role is unset", () => {
    const line = builderFinishLine({ ...ready, roleRecorded: false });
    expect(line).toMatch(/clinical role/i);
    expect(line).toMatch(/writing/i);
    expect(line).not.toMatch(/Ready/i);
  });

  it("blocks Copy when dentist must own Assessment killers", () => {
    const line = builderFinishLine({ ...ready, dentistMustOwnKillers: true });
    expect(line).toMatch(/Dentist must accept Assessment/i);
    expect(line).not.toMatch(/Ready/i);
  });
});
