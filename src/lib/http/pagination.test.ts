import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parsePageParams } from "./pagination";

const at = (qs: string) => parsePageParams(`http://test.local/api/drafts${qs}`);

describe("parsePageParams", () => {
  it("defaults to a bounded first page", () => {
    expect(at("")).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });

  it("accepts a valid page", () => {
    expect(at("?limit=10&offset=20")).toEqual({ limit: 10, offset: 20 });
  });

  // "Give me everything" is the request that would defeat the point.
  it("clamps an oversized limit instead of honoring it", () => {
    expect(at("?limit=100000").limit).toBe(MAX_PAGE_SIZE);
  });

  it("clamps nonsense to something safe rather than erroring", () => {
    // A bad query string must not fail the page load.
    for (const qs of ["?limit=0", "?limit=-5", "?limit=abc", "?limit=NaN", "?limit=Infinity"]) {
      const { limit } = at(qs);
      expect(limit, qs).toBeGreaterThanOrEqual(1);
      expect(limit, qs).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    }
    for (const qs of ["?offset=-1", "?offset=abc", "?offset=-Infinity"]) {
      expect(at(qs).offset, qs).toBeGreaterThanOrEqual(0);
    }
  });

  it("floors fractional values so they never reach an integer column", () => {
    expect(at("?limit=10.9&offset=5.7")).toEqual({ limit: 10, offset: 5 });
  });
});
