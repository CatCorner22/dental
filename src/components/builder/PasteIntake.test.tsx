// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { PasteIntake } from "./PasteIntake";

// The paste intake makes one promise: NOTHING reaches a field unless a person
// puts it there. That is not politeness — auto-placing prose satisfies a
// required-field gate with a paragraph, and writing to a dentist-owned field as
// an auxiliary wedges autosave in a 403 retry loop. So the promise is a safety
// property, and this is what holds it to it.

const NOTE = [
  "The patient reports cold sensitivity on the upper left for two weeks.",
  "No known drug allergies.",
  "Probing depths are generalized 2 to 3 millimetres with no bleeding on probing.",
  "Diagnosis: reversible pulpitis on the upper left first molar.",
  "Plan: place a sedative restoration and review in three weeks."
].join(" ");

const SUBJECTIVE = "universal-core.narrative-subjective";
const ASSESSMENT = "universal-core.narrative-assessment";

// PasteIntake defers its review with useDeferredValue, so the partitions appear
// a tick after the text lands. act() + a microtask flush is what lets the
// assertions see the settled render rather than the pending one.
async function paste(text: string, onSend = vi.fn(), locked = new Set<string>()) {
  const view = render(<PasteIntake onSend={onSend} canEdit lockedSections={locked} />);
  const box = screen.getByLabelText(/paste or type the note/i) as HTMLTextAreaElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )!.set!;
    setter.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { onSend, view };
}

describe("pasting a note", () => {
  it("shows the sentences sorted, and sends nothing on its own", async () => {
    const { onSend } = await paste(NOTE);
    // The sort happened...
    expect(screen.getByText("Subjective")).toBeTruthy();
    expect(screen.getByText("Assessment")).toBeTruthy();
    // ...and not one character of it moved into the note.
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends a partition only when its button is pressed, and only that one", async () => {
    const { onSend } = await paste(NOTE);
    screen.getByRole("button", { name: /send to what the patient reports/i }).click();
    expect(onSend).toHaveBeenCalledTimes(1);
    const [key, text] = onSend.mock.calls[0];
    expect(key).toBe(SUBJECTIVE);
    expect(text).toContain("cold sensitivity on the upper left");
    // The subjective partition carries the subjective sentence and not the plan.
    expect(text).not.toContain("sedative restoration");
  });

  it("keeps the pasted text verbatim — the sort moves sentences, it does not edit", async () => {
    const { onSend } = await paste(NOTE);
    screen.getByRole("button", { name: /send to safety and history/i }).click();
    expect(onSend.mock.calls[0][1]).toBe("No known drug allergies.");
  });

  it("offers every partition its own destination", async () => {
    await paste(NOTE);
    for (const label of [
      /send to safety and history/i,
      /send to what the patient reports/i,
      /send to what you observed and did/i,
      /send to assessment/i,
      /send to plan/i
    ]) {
      expect(screen.getByRole("button", { name: label }), String(label)).toBeTruthy();
    }
  });
});

describe("destinations this licence may not write", () => {
  it("disables them rather than offering a button that will 403", async () => {
    // The scope guard refuses these on save. A button that is going to fail is
    // how someone learns a rule from an error message instead of from the UI.
    await paste(NOTE, vi.fn(), new Set([ASSESSMENT]));
    const assessment = screen.getByRole("button", {
      name: /send to assessment/i
    }) as HTMLButtonElement;
    expect(assessment.disabled).toBe(true);
    expect(assessment.title).toMatch(/dentist/i);
  });

  it("leaves the destinations that ARE theirs alone", async () => {
    await paste(NOTE, vi.fn(), new Set([ASSESSMENT]));
    const subjective = screen.getByRole("button", {
      name: /send to what the patient reports/i
    }) as HTMLButtonElement;
    expect(subjective.disabled).toBe(false);
  });
});

describe("when the sorter declines", () => {
  it("still shows the text with a destination rather than an empty panel", async () => {
    // Under three sentences there is nothing to sort. Showing nothing would
    // read as "the tool did nothing" — which is worse than saying so.
    await paste("The patient reports pain. Reviewed in two weeks.");
    expect(screen.getByText(/too short to sort into sections/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^send to/i }).length).toBeGreaterThan(0);
  });
});

describe("the privacy line", () => {
  it("says what stays in the box and what is saved with the note", () => {
    // It belongs where the pasting happens, not in a page footer.
    render(<PasteIntake onSend={vi.fn()} canEdit lockedSections={new Set()} />);
    expect(screen.getByText(/this box is not saved/i)).toBeTruthy();
    expect(screen.getByText(/saved with the note/i)).toBeTruthy();
  });
});

describe("a read-only viewer", () => {
  it("cannot type into the box", () => {
    render(<PasteIntake onSend={vi.fn()} canEdit={false} lockedSections={new Set()} />);
    const box = screen.getByLabelText(/paste or type the note/i) as HTMLTextAreaElement;
    expect(box.disabled).toBe(true);
  });
});
