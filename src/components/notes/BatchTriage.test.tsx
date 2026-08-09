// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BatchTriage } from "./BatchTriage";

// The page's stated contract: a note leaves through the note builder, past
// the audit, or it does not leave. Batch triage shipped with an UNGATED
// per-row Copy button — one click put an amber note (open S0 stops included)
// on the clipboard, around every export gate the builder enforces. This pins
// the fix: only a clean row offers Copy; a blocked row points at the builder.
describe("BatchTriage copy gating", () => {
  it("offers Copy only on clean rows; blocked rows say resolve in the builder", () => {
    render(<BatchTriage />);
    const clean = "Patient reports mild cold sensitivity on tooth 14 for one week.";
    const blocked = "Call the patient back at 615-555-0142 to discuss tooth 30.";
    fireEvent.change(screen.getByLabelText("Batch notes, separated by --- lines"), {
      target: { value: `${clean}\n---\n${blocked}` }
    });
    fireEvent.click(screen.getByRole("button", { name: "Check all" }));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const [cleanRow, blockedRow] = rows;

    expect(cleanRow.textContent).toContain("clean");
    expect(cleanRow.querySelector("button")).not.toBeNull();

    expect(blockedRow.textContent).toContain("to resolve");
    // The whole point: no copy affordance on a note the audit still blocks.
    expect(blockedRow.querySelector("button")).toBeNull();
    expect(blockedRow.textContent).toContain("resolve in the builder");
  });
});
