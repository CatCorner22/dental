// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProgressRing } from "./ProgressRing";
import type { Severity } from "@/lib/audit/types";

const clear: Record<Severity, number> = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };

describe("ProgressRing — finish honesty (UIX-003)", () => {
  it("shows 100% when audit is clear AND filing is allowed", () => {
    const { container } = render(<ProgressRing counts={clear} filingAllowed />);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Ready/i);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/100%/);
    expect(container.textContent).toMatch(/100%/);
  });

  it("caps at 80% and names dentist filing when filing is blocked", () => {
    const { container } = render(<ProgressRing counts={clear} filingAllowed={false} />);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Handoff|dentist must file/i);
    expect(container.textContent).toMatch(/80%/);
  });

  it("names Review with a non-color shape when only S2 remains (CVD co-design)", () => {
    const { container } = render(
      <ProgressRing counts={{ ...clear, S2: 2 }} filingAllowed />
    );
    const label = container.querySelector("svg")!.getAttribute("aria-label")!;
    expect(label).toMatch(/Review/i);
    expect(label).not.toMatch(/Ready/i);
    expect(container.textContent).toMatch(/◆/);
  });

  it("names Stop when S0 is open", () => {
    const { container } = render(
      <ProgressRing counts={{ ...clear, S0: 1 }} filingAllowed />
    );
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Stop/i);
    expect(container.textContent).toMatch(/■/);
  });
});
