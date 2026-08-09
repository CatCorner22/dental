// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ConflictDialog } from "./BuilderDialogs";

// The save-conflict dialog is the one place a click silently overwrites a
// teammate's saved version ("Keep editing here" = last-writer-wins). That
// choice must be deliberate — never the reflexive ESC / backdrop-click / ✕ a
// user makes to wave a modal away. This pins that contract: the dialog is
// non-dismissible, and its two buttons do exactly what they say. It has never
// been rendered by any test.
describe("ConflictDialog", () => {
  it("offers exactly the two documented choices", () => {
    render(<ConflictDialog onReload={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Keep editing here" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeTruthy();
  });

  it("routes each button to its own handler", () => {
    const onReload = vi.fn();
    const onClose = vi.fn();
    render(<ConflictDialog onReload={onReload} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing here" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is not dismissible — ESC does not resolve the conflict", () => {
    const onClose = vi.fn();
    const onReload = vi.fn();
    render(<ConflictDialog onReload={onReload} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("is not dismissible — there is no ✕ close affordance", () => {
    render(<ConflictDialog onReload={() => {}} onClose={() => {}} />);
    // The only buttons are the two explicit choices; a dismissible Dialog would
    // add a "Close" ✕ button.
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
