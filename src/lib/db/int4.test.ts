import { describe, expect, it } from "vitest";
import { INT4_MAX, isInt4, parseRowId } from "./int4";

describe("parseRowId", () => {
  it("accepts a real row id", () => {
    expect(parseRowId("1")).toBe(1);
    expect(parseRowId(String(INT4_MAX))).toBe(INT4_MAX);
  });

  // The bug this exists for: Number.isInteger(1e21) is true, so an id past
  // int4 sailed through the old check and reached the driver, which threw
  // "value out of range for type integer" — a 500 or a white-screened page
  // where a 404 belonged.
  it("rejects integers past what the column can hold", () => {
    expect(Number.isInteger(Number("999999999999999999999"))).toBe(true); // the trap
    expect(parseRowId("999999999999999999999")).toBeNull();
    expect(parseRowId(String(INT4_MAX + 1))).toBeNull();
    expect(isInt4(1e21)).toBe(false);
  });

  it("rejects everything that is not a plain positive integer", () => {
    for (const raw of ["0", "-1", "1.5", "abc", "", "  ", "1e5", "0x10", "NaN", "Infinity", "1,2"]) {
      expect(parseRowId(raw), raw).toBeNull();
    }
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRowId(" 42 ")).toBe(42);
  });
});
