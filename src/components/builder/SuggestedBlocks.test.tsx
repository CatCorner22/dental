// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SuggestedBlocks } from "./SuggestedBlocks";

describe("SuggestedBlocks — cognitive load contract", () => {
  const base = {
    moduleId: "universal-core",
    sectionId: "care-delivered",
    selectedModuleIds: ["universal-core", "direct-restorative", "medication"],
    clinicalRole: "dentist" as const,
    outOfScope: false,
    sectionOpen: true,
    fields: [
      { id: "procedure-status", type: "select" },
      { id: "complication-status", type: "text" },
      { id: "patient-response", type: "text" }
    ],
    onInsert: vi.fn()
  };

  it("renders nothing when the section is collapsed", () => {
    const { container } = render(<SuggestedBlocks {...base} sectionOpen={false} />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing on narrative even if forced open", () => {
    const { container } = render(
      <SuggestedBlocks {...base} sectionId="narrative" sectionOpen={true} />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when the section is out of scope", () => {
    const { container } = render(<SuggestedBlocks {...base} outOfScope />);
    expect(container.textContent).toBe("");
  });

  it("starts closed — only the chip, not the assertion panels", () => {
    render(<SuggestedBlocks {...base} />);
    expect(screen.getByRole("button", { name: /suggested wording/i })).toBeTruthy();
    expect(screen.queryByText(/confirm each statement/i)).toBeNull();
  });

  it("opens a short ranked list, not the full DES-12 catalog", () => {
    render(<SuggestedBlocks {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /suggested wording/i }));
    expect(screen.getByText(/local anesthetic/i)).toBeTruthy();
    expect(screen.queryByText(/general encounter \(des-12/i)).toBeNull();
    expect(screen.queryByText(/my blocks/i)).toBeNull();
  });

  it("keeps focus by preventing mousedown default on the chip", () => {
    render(<SuggestedBlocks {...base} />);
    const chip = screen.getByRole("button", { name: /suggested wording/i });
    const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    chip.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
