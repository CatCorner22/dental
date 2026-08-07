// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { Dialog } from "./Dialog";

// THE HOLE IN THE FOCUS TRAP.
//
// The trap works by comparing the focused element against the first and last
// entries of a query for everything tabbable. Anything the browser will tab to
// that the query does not find is therefore an escape hatch: focus lands on
// it, it matches neither end, the handler falls through, and the next Tab
// walks into the page behind the modal — which for a screen-reader user means
// silently leaving a dialog that still says aria-modal="true".
//
// `<summary>` was the one that mattered. This app puts disclosures inside
// dialogs — the help tips, the module picker, the revision list — and a
// summary is tabbable in every browser while being none of the element types
// the old query asked for.

function press(el: Element, shiftKey = false) {
  fireEvent.keyDown(document, { key: "Tab", shiftKey });
  return el;
}

describe("tab cannot leave the dialog", () => {
  it("treats a summary as the last stop, not as nothing", () => {
    const { getByText, getByLabelText } = render(
      <Dialog title="With a disclosure" onClose={() => {}}>
        <button>First</button>
        <details>
          <summary>Why this matters</summary>
          <p>Because it is tabbable.</p>
        </details>
      </Dialog>
    );
    const summary = getByText("Why this matters");
    summary.focus();
    expect(document.activeElement).toBe(summary);
    press(summary);
    // Wrapped back to the close button, which is the first control in the
    // panel — NOT left on the summary, and not out in the page behind.
    expect(document.activeElement).toBe(getByLabelText("Close dialog"));
    cleanup();
  });

  it("wraps backwards off the first control", () => {
    const { getByLabelText, getByText } = render(
      <Dialog title="Two ends" onClose={() => {}}>
        <button>Only</button>
      </Dialog>
    );
    const close = getByLabelText("Close dialog");
    close.focus();
    press(close, true);
    expect(document.activeElement).toBe(getByText("Only"));
    cleanup();
  });

  it("holds focus in a dialog with nothing to tab to", () => {
    // A dismissible={false} gate whose body is a sentence has no controls at
    // all. Returning early there let Tab straight out of a modal the user is
    // not allowed to leave.
    const { getByRole } = render(
      <Dialog title="Read this" onClose={() => {}} dismissible={false}>
        <p>Nothing here is focusable.</p>
      </Dialog>
    );
    const panel = getByRole("dialog");
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(panel);
    cleanup();
  });

  it("skips a control that is not on screen", () => {
    // A hidden button cannot take focus. Counting it as the first entry meant
    // the opening focus call silently did nothing and left the caret on
    // <body>, which is the same escape by a different route.
    const { getByText } = render(
      <Dialog title="Half hidden" onClose={() => {}}>
        <button style={{ display: "none" }}>Hidden</button>
        <button>Visible</button>
      </Dialog>
    );
    // The close button is first; the hidden one must not be counted at all.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByText("Visible"));
    cleanup();
  });
});

describe("escape still belongs to the topmost dialog", () => {
  it("closes a dismissible dialog", () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Closable" onClose={onClose}>
        <button>Anything</button>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("is refused by a gate that requires a choice", () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Gate" onClose={onClose} dismissible={false}>
        <button>Agree</button>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
  });
});
