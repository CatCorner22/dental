// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TextareaField_ } from "./inputs";
import type { TextareaField } from "@/lib/schema/types";

// THE APPROVAL GATE.
//
// Standardize used to rewrite the field the instant it was pressed and offer
// Undo afterwards. That asks a clinician to NOTICE an unrequested edit to a
// legal record and object to it, which is the burden the wrong way round: the
// deterministic pass is very good, and very good is still not consent.
//
// So the promise is now: the tool proposes, the person disposes. Nothing
// reaches the note until somebody has read the difference and said yes. These
// tests hold it to that.

const FIELD: TextareaField = {
  id: "narrative-objective",
  type: "textarea",
  label: "What you observed and did"
};

// Wording the standardizer definitely rewrites: "pt" -> "patient" and the
// missing terminal period.
const MESSY = "pt tolerated the procedure well";

function renderField(value: string) {
  const onChange = vi.fn();
  render(
    <TextareaField_
      field={FIELD}
      value={{ kind: "text", value }}
      onChange={onChange}
      id="field-universal-core-narrative-objective"
    />
  );
  return { onChange };
}

const propose = () => fireEvent.click(screen.getByRole("button", { name: /standardize/i }));

describe("pressing Standardize", () => {
  it("changes nothing in the note by itself", () => {
    // The one that matters. A press is a question, not an instruction.
    const { onChange } = renderField(MESSY);
    propose();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says out loud that the note is untouched", () => {
    renderField(MESSY);
    propose();
    expect(screen.getByText(/nothing has changed in your note yet/i)).toBeTruthy();
  });

  it("shows the proposal rather than describing it", () => {
    // Accepting a rewrite of a clinical record on the strength of a word count
    // is not a decision, it is a guess. The diff is opened for them.
    const { onChange } = renderField(MESSY);
    propose();
    expect(screen.getByRole("button", { name: /apply this wording/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /keep mine/i })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("answering the question", () => {
  it("writes the rewrite only once it is accepted", () => {
    const { onChange } = renderField(MESSY);
    propose();
    fireEvent.click(screen.getByRole("button", { name: /apply this wording/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [written] = onChange.mock.calls[0];
    expect(written.kind).toBe("text");
    expect(written.value.toLowerCase()).toContain("patient");
    expect(written.value).not.toBe(MESSY);
  });

  it("writes nothing at all when it is declined", () => {
    // Declining must be free. If "Keep mine" wrote the original back it would
    // count as an edit, dirty the autosave and bump the draft revision — a
    // record change caused by refusing a record change.
    const { onChange } = renderField(MESSY);
    propose();
    fireEvent.click(screen.getByRole("button", { name: /keep mine/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("puts the question away once it is answered either way", () => {
    renderField(MESSY);
    propose();
    fireEvent.click(screen.getByRole("button", { name: /keep mine/i }));
    expect(screen.queryByRole("button", { name: /apply this wording/i })).toBeNull();
    expect(screen.queryByText(/nothing has changed in your note yet/i)).toBeNull();
  });

  it("cannot be asked twice while one answer is outstanding", () => {
    // Two pending proposals over one field is a way to accept the wrong one.
    renderField(MESSY);
    propose();
    expect((screen.getByRole("button", { name: /standardize/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});

describe("when there is nothing to propose", () => {
  it("offers no decision on text that is already standard", () => {
    const { onChange } = renderField("The patient tolerated the procedure well.");
    propose();
    expect(screen.queryByRole("button", { name: /apply this wording/i })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
