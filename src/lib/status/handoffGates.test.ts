import { describe, expect, it } from "vitest";
import { killersBlockHandoff } from "./handoffGates";

describe("killersBlockHandoff", () => {
  it("blocks when any litigation killer is open", () => {
    expect(killersBlockHandoff(1)).toBe(true);
    expect(killersBlockHandoff(3)).toBe(true);
  });

  it("does not block when the killer set is empty (Soft S2 non-killers may remain)", () => {
    expect(killersBlockHandoff(0)).toBe(false);
  });
});
