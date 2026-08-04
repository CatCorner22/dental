import { describe, expect, it } from "vitest";
import {
  LICENSE_SCOPE_MERMAID,
  LICENSE_SCOPES,
  scopeById
} from "./license-scope";

describe("TN license scope corpus", () => {
  it("covers dentist, hygienist, RDA, and practical DA", () => {
    expect(LICENSE_SCOPES.map((s) => s.id).sort()).toEqual(
      ["dentist", "dental-hygienist", "practical-dental-assistant", "registered-dental-assistant"].sort()
    );
  });

  it("every may / may-not / cert item carries at least one citation", () => {
    for (const scope of LICENSE_SCOPES) {
      for (const item of [...scope.may, ...scope.mayNot, ...scope.withCertification]) {
        expect(item.citations.length, `${scope.id}: ${item.text}`).toBeGreaterThan(0);
        expect(item.citations.join(" ")).toMatch(/63-5|0460|Pub\. Ch\.|Public Chapter|Tenn\./i);
      }
    }
  });

  it("reserves diagnosis to the dentist and scaling among auxiliaries to hygienists", () => {
    const dds = scopeById("dentist")!;
    const rdh = scopeById("dental-hygienist")!;
    const rda = scopeById("registered-dental-assistant")!;

    expect(dds.may.some((i) => /diagnos/i.test(i.text))).toBe(true);
    expect(rdh.mayNot.some((i) => /diagnos/i.test(i.text))).toBe(true);
    expect(rda.mayNot.some((i) => /diagnos/i.test(i.text))).toBe(true);
    expect(rdh.mayNot.some((i) => /Scale|scaling/i.test(i.text))).toBe(true);
    expect(rda.mayNot.some((i) => /scale|root plane/i.test(i.text))).toBe(true);
  });

  it("mermaid charts mention the core citations", () => {
    const all = Object.values(LICENSE_SCOPE_MERMAID).join("\n");
    expect(all).toContain("63-5-108");
    expect(all).toContain("0460-03");
    expect(all).toContain("0460-04");
    expect(all).toContain("1107");
  });

  it("hygienist local anesthesia requires direct supervision and certification citations", () => {
    const rdh = scopeById("dental-hygienist")!;
    const la = rdh.withCertification.find((i) => /local anesthesia/i.test(i.text));
    expect(la).toBeDefined();
    expect(la!.citations.join(" ")).toMatch(/0460-03-\.12|0460-03-\.09/);
    expect(la!.citations.join(" ")).toMatch(/63-5-108/);
  });
});
