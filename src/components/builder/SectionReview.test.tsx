// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";

import { NoteForm } from "./NoteForm";
import type { ModuleDef, NoteState } from "@/lib/schema/types";

// WRITE A SECTION, CHECK IT, ACCEPT IT, MOVE ON.
//
// The loop the note is written in. Its two promises are the ones worth pinning:
// nothing is checked until somebody asks, and nothing is written until somebody
// accepts. Everything else here is about not losing a person's place.

const MODULE: ModuleDef = {
  id: "m",
  title: "Test module",
  order: 0,
  sections: [
    {
      id: "narrative",
      title: "Visit narrative",
      fields: [{ id: "prose", type: "textarea", label: "In your own words" }]
    },
    {
      id: "visit",
      title: "Visit",
      fields: [{ id: "purpose", type: "text", label: "Visit purpose", required: true }]
    },
    {
      id: "assessment",
      title: "Assessment",
      fields: [{ id: "diagnosis", type: "text", label: "Diagnosis" }]
    }
  ]
};

const note = (values: NoteState["values"] = {}): NoteState => ({
  selectedModuleIds: ["m"],
  values
});

function renderForm(values: NoteState["values"] = {}, findingsByField = {}) {
  const onChange = vi.fn();
  const { container } = render(
    <NoteForm
      modules={[MODULE]}
      state={note(values)}
      onChange={onChange}
      findingsByField={findingsByField}
      clinicalRole="dentist"
    />
  );
  const section = (id: string) =>
    container.querySelector<HTMLDetailsElement>(`details[data-section="m.${id}"]`)!;
  return { onChange, container, section };
}

const MESSY = { "m.prose": { kind: "text" as const, value: "pt tolerated the procedure well" } };

describe("before anything is asked", () => {
  it("offers to check each section and says nothing else", () => {
    // A section that announced its own findings unprompted would be the
    // wall-of-live-feedback arrangement this replaces.
    const { section } = renderForm(MESSY);
    const narrative = within(section("narrative"));
    expect(narrative.getByRole("button", { name: /check this section/i })).toBeTruthy();
    expect(narrative.queryByText(/suggested wording/i)).toBeNull();
  });

  it("every section carries its own check, not one for the note", () => {
    const { section } = renderForm();
    for (const id of ["narrative", "visit", "assessment"]) {
      expect(
        within(section(id)).getByRole("button", { name: /check this section/i }),
        id
      ).toBeTruthy();
    }
  });
});

describe("checking a section", () => {
  const check = (el: HTMLElement) =>
    fireEvent.click(within(el).getByRole("button", { name: /check this section/i }));

  it("shows what it found, and changes nothing", () => {
    const { onChange, section } = renderForm(MESSY);
    check(section("narrative"));
    expect(within(section("narrative")).getByText(/suggested wording/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the required fields that are still empty", () => {
    const { section } = renderForm();
    check(section("visit"));
    const panel = within(section("visit"));
    expect(panel.getByText(/1 required field still empty/i)).toBeTruthy();
    expect(panel.getAllByText("Visit purpose").length).toBeGreaterThan(1);
  });

  it("says so plainly when there is nothing to raise", () => {
    const { section } = renderForm({
      "m.diagnosis": { kind: "text", value: "Reversible pulpitis." }
    });
    check(section("assessment"));
    expect(within(section("assessment")).getByText(/nothing to raise in this section/i)).toBeTruthy();
  });

  it("checks only the section that was asked", () => {
    const { section } = renderForm(MESSY);
    check(section("narrative"));
    expect(within(section("visit")).getByRole("button", { name: /check this section/i })).toBeTruthy();
  });
});

describe("answering a proposal", () => {
  const check = (el: HTMLElement) =>
    fireEvent.click(within(el).getByRole("button", { name: /check this section/i }));

  it("writes the rewrite only when it is used", () => {
    const { onChange, section } = renderForm(MESSY);
    check(section("narrative"));
    fireEvent.click(within(section("narrative")).getByRole("button", { name: /use this wording/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [key, value] = onChange.mock.calls[0];
    expect(key).toBe("m.prose");
    expect(value.value.toLowerCase()).toContain("patient");
  });

  it("writes nothing when the writer keeps their own", () => {
    // Declining has to be free. Writing the original back would dirty autosave
    // and bump the revision — a record change caused by refusing one.
    const { onChange, section } = renderForm(MESSY);
    check(section("narrative"));
    fireEvent.click(within(section("narrative")).getByRole("button", { name: /keep mine/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops offering a proposal that has been answered", () => {
    const { section } = renderForm(MESSY);
    check(section("narrative"));
    fireEvent.click(within(section("narrative")).getByRole("button", { name: /keep mine/i }));
    expect(within(section("narrative")).queryByText(/suggested wording/i)).toBeNull();
  });
});

describe("accepting and moving on", () => {
  const check = (el: HTMLElement) =>
    fireEvent.click(within(el).getByRole("button", { name: /check this section/i }));

  it("will not accept a section with a required field still empty", () => {
    // The section-level echo of the submit gate. Letting somebody tick past an
    // empty required field means meeting it again at Submit with no idea why.
    const { section } = renderForm();
    check(section("visit"));
    const accept = within(section("visit")).getByRole("button", {
      name: /accept and go to the next section/i
    }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    expect(within(section("visit")).getByText(/fill the required fields above first/i)).toBeTruthy();
  });

  it("accepts a section that is complete, and marks it checked", () => {
    const { section } = renderForm({ "m.purpose": { kind: "text", value: "Routine recall." } });
    check(section("visit"));
    fireEvent.click(
      within(section("visit")).getByRole("button", { name: /accept and go to the next section/i })
    );
    expect(within(section("visit")).getByText(/checked\. edit anything here/i)).toBeTruthy();
  });

  it("collapses the finished section and opens the next one", () => {
    // The note gets SHORTER as it gets more complete, which is the opposite of
    // what a long form usually does to a person.
    const { section } = renderForm({ "m.purpose": { kind: "text", value: "Routine recall." } });
    check(section("visit"));
    fireEvent.click(
      within(section("visit")).getByRole("button", { name: /accept and go to the next section/i })
    );
    expect(section("visit").open).toBe(false);
    expect(section("assessment").open).toBe(true);
  });

  it("says when there is nowhere further to go", () => {
    const { section } = renderForm();
    check(section("assessment"));
    expect(
      within(section("assessment")).getByRole("button", { name: /this is the last section/i })
    ).toBeTruthy();
  });

  it("lets the writer go back to editing instead", () => {
    const { section } = renderForm(MESSY);
    check(section("narrative"));
    fireEvent.click(
      within(section("narrative")).getByRole("button", { name: /keep editing this one/i })
    );
    expect(
      within(section("narrative")).getByRole("button", { name: /check this section/i })
    ).toBeTruthy();
  });
});

describe("a tick that stops being true", () => {
  it("drops the check when the section is edited afterwards", () => {
    // THE one that matters. "I read this and it was right" was said about
    // words; change the words and it is no longer a statement about anything.
    const values = { "m.purpose": { kind: "text" as const, value: "Routine recall." } };
    const { section, container } = renderForm(values);
    fireEvent.click(within(section("visit")).getByRole("button", { name: /check this section/i }));
    fireEvent.click(
      within(section("visit")).getByRole("button", { name: /accept and go to the next section/i })
    );
    expect(within(section("visit")).getByText(/checked\. edit anything here/i)).toBeTruthy();

    // Re-render with the section's content changed, as autosave state would.
    render(
      <NoteForm
        modules={[MODULE]}
        state={note({ "m.purpose": { kind: "text", value: "Routine recall. And more." } })}
        onChange={() => {}}
        findingsByField={{}}
        clinicalRole="dentist"
      />,
      { container }
    );
    expect(
      within(section("visit")).getByRole("button", { name: /check this section/i })
    ).toBeTruthy();
  });
});

describe("a section this licence may not write", () => {
  it("offers no check at all on a locked section", () => {
    // A hygienist cannot author Assessment. A check that could only ever end in
    // a 403 on the next autosave is not a check.
    const CORE: ModuleDef = { ...MODULE, id: "universal-core" };
    const { container } = render(
      <NoteForm
        modules={[CORE]}
        state={{ selectedModuleIds: ["universal-core"], values: {} }}
        onChange={() => {}}
        findingsByField={{}}
        clinicalRole="hygienist"
      />
    );
    const locked = container.querySelector<HTMLDetailsElement>(
      'details[data-section="universal-core.assessment"]'
    )!;
    expect(within(locked).queryByRole("button", { name: /check this section/i })).toBeNull();
  });
});
