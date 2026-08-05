import { describe, expect, it } from "vitest";
import {
  copyForEdrLabel,
  edrProductName,
  edrProductShort,
  edrSourceToken,
  edrTransferChecklistTitle
} from "./product";

describe("edr product seam", () => {
  it("defaults to Curve Hero when unset", () => {
    const env = {};
    expect(edrProductName(env)).toBe("Curve Hero");
    expect(copyForEdrLabel(env)).toBe("Copy for Curve Hero");
    expect(edrTransferChecklistTitle(env)).toMatch(/Curve Hero/);
  });

  it("honors EDR_PRODUCT_NAME for multi-PMS deploys", () => {
    const env = {
      EDR_PRODUCT_NAME: "Acme Dental Chart",
      EDR_PRODUCT_SHORT: "Acme"
    };
    expect(edrProductName(env)).toBe("Acme Dental Chart");
    expect(edrProductShort(env)).toBe("Acme");
    expect(copyForEdrLabel(env)).toBe("Copy for Acme");
    expect(edrSourceToken(env)).toBe("acme dental chart");
  });

  it("falls back to NEXT_PUBLIC_ when server var is empty", () => {
    const env = { NEXT_PUBLIC_EDR_PRODUCT_NAME: "Open Dental" };
    expect(edrProductName(env)).toBe("Open Dental");
  });
});
