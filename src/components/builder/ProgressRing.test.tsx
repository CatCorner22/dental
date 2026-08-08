// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressRing } from "./ProgressRing";
import type { Severity } from "@/lib/audit/types";

const clear: Record<Severity, number> = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };

describe("ProgressRing — finish honesty (UIX-003)", () => {
  it("shows 100% when audit is clear AND filing is allowed", () => {
    render(<ProgressRing counts={clear} filingAllowed />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Ready/i);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/100%/);
    expect(screen.getByRole("img").textContent).toMatch(/100%/);
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("caps at 80% and names dentist filing when filing is blocked", () => {
    render(<ProgressRing counts={clear} filingAllowed={false} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Handoff|dentist must file/i);
    expect(screen.getByRole("img").textContent).toMatch(/80%/);
    expect(screen.getByText("Handoff")).toBeTruthy();
  });

  it("names Review with a non-color shape when only S2 remains (CVD co-design)", () => {
    render(<ProgressRing counts={{ ...clear, S2: 2 }} filingAllowed />);
    const label = screen.getByRole("img").getAttribute("aria-label")!;
    expect(label).toMatch(/Review/i);
    expect(label).not.toMatch(/Ready/i);
    expect(screen.getByRole("img").textContent).toMatch(/◆/);
    expect(screen.getByText("Review")).toBeTruthy();
  });

  it("names Stop when S0 is open", () => {
    render(<ProgressRing counts={{ ...clear, S0: 1 }} filingAllowed />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Stop/i);
    expect(screen.getByRole("img").textContent).toMatch(/■/);
  });
});
