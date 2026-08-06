// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TextareaField_ } from "./inputs";
import type { TextareaField } from "@/lib/schema/types";

// The verified-block chip appears under the field the cursor is in, and TWO
// reviewers found the same design failing from opposite ends.
//
// Watching focus on the textarea alone, a blur whose relatedTarget was inside
// the field was ignored so that clicking the chip would not unmount it
// mid-click. That is right once and wrong forever after: once focus is on the
// chip, the textarea never blurs again, so the chip stayed mounted under an
// empty field for the rest of the session — one more under every field visited.
// And Safari and Firefox on macOS do not focus a button when it is clicked at
// all, so relatedTarget was null, the guard did not fire, and the chip
// unmounted between mousedown and click: on those browsers verified blocks
// could not be opened on an empty field.
//
// Focus is tracked on the wrapper now, and the chip does not take focus on
// press. These are the four paths that has to get right.

const FIELD: TextareaField = {
  id: "narrative-subjective",
  type: "textarea",
  label: "What the patient reports"
};

function renderField(value = "") {
  const onChange = vi.fn();
  const view = render(
    <TextareaField_
      field={FIELD}
      value={value ? { kind: "text", value } : undefined}
      onChange={onChange}
      id="field-universal-core-narrative-subjective"
    />
  );
  const box = screen.getByRole("textbox") as HTMLTextAreaElement;
  const chip = () => screen.queryByRole("button", { name: /verified block/i });
  return { view, box, chip, onChange };
}

describe("when the verified-block chip is offered", () => {
  it("is not there under an untouched field nobody is in", () => {
    // It used to render under every textarea, so the visit narrative alone
    // opened with three identical controls on a note nobody had touched.
    const { chip } = renderField();
    expect(chip()).toBeNull();
  });

  it("appears when the cursor lands in the field", () => {
    const { box, chip } = renderField();
    fireEvent.focus(box);
    expect(chip()).toBeTruthy();
  });

  it("stays under a field that already has text in it", () => {
    const { chip } = renderField("Cold sensitivity for two weeks.");
    expect(chip()).toBeTruthy();
  });
});

describe("when focus moves", () => {
  it("keeps the chip while focus is on the chip itself", () => {
    // Tabbing from the textarea to the chip is not leaving the field. Without
    // this the chip vanished from under the keyboard on the way to it.
    const { box, chip } = renderField();
    fireEvent.focus(box);
    const button = chip()!;
    fireEvent.blur(box, { relatedTarget: button });
    expect(chip()).toBeTruthy();
  });

  it("clears once focus leaves the field entirely, even via the chip", () => {
    // THE stuck-open case. Focus reached the chip, and every later focus change
    // happened on the button rather than the textarea — so a guard living on
    // the textarea would never hear about the departure, and the chip stayed
    // for the rest of the session. The wrapper hears it.
    const { box, chip } = renderField();
    fireEvent.focus(box);
    const button = chip()!;
    fireEvent.blur(box, { relatedTarget: button });
    fireEvent.focus(button);

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    fireEvent.blur(button, { relatedTarget: outside });

    expect(chip()).toBeNull();
    outside.remove();
  });

  it("clears when focus leaves for somewhere else without touching the chip", () => {
    const { box, chip } = renderField();
    fireEvent.focus(box);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    fireEvent.blur(box, { relatedTarget: outside });
    expect(chip()).toBeNull();
    outside.remove();
  });
});

describe("pressing the chip", () => {
  it("does not let the press move focus off the field", () => {
    // Safari and Firefox on macOS do not focus a button on click, so the field
    // blurred with a null relatedTarget and the chip unmounted before the click
    // landed. preventDefault on mousedown is what stops the blur happening at
    // all — and the assertion is that the event is refused, because "the chip
    // survives" is exactly what jsdom cannot tell us here: it does not
    // implement the focus-on-click behaviour that breaks it.
    const { box, chip } = renderField();
    fireEvent.focus(box);
    const prevented = !fireEvent.mouseDown(chip()!);
    expect(prevented).toBe(true);
  });

  it("opens the picker, and keeps it open after focus leaves", () => {
    // Once it is open it is a panel someone is reading, not a hint — it must
    // not evaporate because they clicked into a checkbox inside it.
    const { box, chip } = renderField();
    fireEvent.focus(box);
    fireEvent.click(chip()!);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    fireEvent.blur(box, { relatedTarget: outside });
    expect(chip()).toBeTruthy();
    outside.remove();
  });
});

describe("the writer's own saved blocks", () => {
  it("are reachable from the picker", () => {
    // BlockChips replaced BlockPicker, which was the only thing that rendered
    // MyBlocks — the create/insert/delete UI over /api/me/blocks. Without this
    // the table and its routes survived with no way in: every block anyone had
    // saved became unreachable and the feature write-only.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ blocks: [] }) }))
    );
    const { box, chip } = renderField();
    fireEvent.focus(box);
    fireEvent.click(chip()!);
    expect(screen.getByText(/my blocks/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /save a new block/i })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
