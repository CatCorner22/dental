// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { NoteForm } from "./NoteForm";
import type { ModuleDef, NoteState } from "@/lib/schema/types";
import type { FieldFindings } from "@/lib/audit/byField";

// Universal Core is eleven sections and about sixty controls. Collapsing them
// is what makes the note usable on the home page, and the rule for WHICH ones
// start open is the fiddliest thing in this component — get it slightly wrong
// and either the collapse does nothing or it hides work someone already did.
//
// A synthetic module, so this tests the RULE rather than the current contents
// of universal-core.ts.

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
      fields: [
        { id: "purpose", type: "text", label: "Visit purpose", required: true },
        { id: "notes", type: "text", label: "Other notes" }
      ]
    },
    {
      id: "assessment",
      title: "Assessment",
      fields: [{ id: "diagnosis", type: "text", label: "Diagnosis", required: true }]
    }
  ]
};

const note = (values: NoteState["values"] = {}): NoteState => ({
  selectedModuleIds: ["m"],
  values
});

function sections(
  state: NoteState,
  findingsByField: FieldFindings = {}
): Record<string, HTMLDetailsElement> {
  const { container } = render(
    <NoteForm
      modules={[MODULE]}
      state={state}
      onChange={() => {}}
      findingsByField={findingsByField}
      clinicalRole="dentist"
    />
  );
  const out: Record<string, HTMLDetailsElement> = {};
  for (const el of container.querySelectorAll<HTMLDetailsElement>("details[data-section]")) {
    out[el.dataset.section!] = el;
  }
  return out;
}

const requiredMissing = (fieldId: string): FieldFindings => ({
  [`m.${fieldId}`]: [
    {
      ruleId: "required.missing",
      category: "required",
      severity: "S1",
      message: "is required and empty."
    }
  ]
});

describe("which sections start open", () => {
  it("opens the narrative and closes the rest on an empty note", () => {
    const s = sections(note());
    expect(s["m.narrative"].open).toBe(true);
    expect(s["m.visit"].open).toBe(false);
    expect(s["m.assessment"].open).toBe(false);
  });

  it("does NOT open a section just because its required fields are empty", () => {
    // The subtlety the whole rule turns on. On a new note every required field
    // raises required.missing, so counting those as "a finding worth opening
    // for" would open ten of eleven sections and the collapse would do nothing
    // at all on the one screen it exists for. An empty note is not a note with
    // problems.
    const s = sections(note(), { ...requiredMissing("purpose"), ...requiredMissing("diagnosis") });
    expect(s["m.visit"].open).toBe(false);
    expect(s["m.assessment"].open).toBe(false);
  });

  it("opens a section carrying any OTHER finding", () => {
    // Something in here has been written and needs a second look.
    const s = sections(note(), {
      "m.notes": [
        {
          ruleId: "vague.tolerated-well",
          category: "vague-phrase",
          severity: "S2",
          message: "vague"
        }
      ]
    });
    expect(s["m.visit"].open).toBe(true);
  });

  it("opens a section that already has something in it", () => {
    // Hiding a person's own work is worse than showing too much.
    const s = sections(note({ "m.purpose": { kind: "text", value: "Routine recall." } }));
    expect(s["m.visit"].open).toBe(true);
  });

  it("treats a whitespace-only value as empty", () => {
    const s = sections(note({ "m.purpose": { kind: "text", value: "   " } }));
    expect(s["m.visit"].open).toBe(false);
  });
});

describe("what a closed section still says", () => {
  it("counts its open required fields, so nothing hides", () => {
    // A closed section that says nothing is a section people forget, which is
    // exactly how a required field goes unnoticed until the submit is refused.
    const s = sections(note());
    expect(s["m.visit"].querySelector("summary")!.textContent).toContain("1 required");
    expect(s["m.assessment"].querySelector("summary")!.textContent).toContain("1 required");
  });

  it("stops counting a required field once it is filled", () => {
    const s = sections(note({ "m.purpose": { kind: "text", value: "Routine recall." } }));
    expect(s["m.visit"].querySelector("summary")!.textContent).not.toContain("required");
  });

  it("counts findings to review separately from required fields", () => {
    const s = sections(note(), {
      "m.notes": [
        { ruleId: "vague.x", category: "vague-phrase", severity: "S2", message: "vague" }
      ]
    });
    expect(s["m.visit"].querySelector("summary")!.textContent).toContain("1 to review");
  });
});

describe("the scope lock, still enforced under a collapsed section", () => {
  // Ownership is keyed on the REAL module and section ids — the set in
  // clinicalRoles.ts is `universal-core.assessment` and `universal-core.plan`
  // — so this fixture has to carry the real id. That is the design working:
  // "m.assessment" is not a dentist's section just because it is called
  // Assessment, and a module cannot opt itself into someone else's authority
  // by naming a section after theirs.
  const CORE: ModuleDef = { ...MODULE, id: "universal-core" };
  const coreNote: NoteState = { selectedModuleIds: ["universal-core"], values: {} };

  const renderAs = (clinicalRole: "hygienist" | "dentist") =>
    render(
      <NoteForm
        modules={[CORE]}
        state={coreNote}
        onChange={() => {}}
        findingsByField={{}}
        clinicalRole={clinicalRole}
      />
    );

  it("disables a dentist-owned section for a hygienist and says who records it", () => {
    const { container, getByText } = renderAs("hygienist");
    const assessment = container.querySelector<HTMLDetailsElement>(
      'details[data-section="universal-core.assessment"]'
    )!;
    expect(assessment.querySelector("fieldset")!.disabled).toBe(true);
    expect(getByText(/dentist records this/i)).toBeTruthy();
    // And the section a hygienist DOES own stays writable — locking more than
    // the rule says would make the tool unusable for the people who use it most.
    const visit = container.querySelector<HTMLDetailsElement>(
      'details[data-section="universal-core.visit"]'
    )!;
    expect(visit.querySelector("fieldset")!.disabled).toBe(false);
  });

  it("leaves everything writable for a dentist", () => {
    const { container } = renderAs("dentist");
    for (const fs of container.querySelectorAll("fieldset")) expect(fs.disabled).toBe(false);
  });

  it("does not lock a section merely named Assessment on another module", () => {
    const { container } = render(
      <NoteForm
        modules={[MODULE]}
        state={note()}
        onChange={() => {}}
        findingsByField={{}}
        clinicalRole="hygienist"
      />
    );
    const assessment = container.querySelector<HTMLDetailsElement>(
      'details[data-section="m.assessment"]'
    )!;
    expect(assessment.querySelector("fieldset")!.disabled).toBe(false);
  });
});
