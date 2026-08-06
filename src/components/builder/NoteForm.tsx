"use client";

import { useState } from "react";
import {
  canRecordClinicalJudgement,
  isDentistOwnedSection,
  scopeExplanation,
  type ClinicalRole
} from "@/lib/auth/clinicalRoles";

import type { Field, FieldValue, ModuleDef, NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldRequired, isFieldVisible } from "@/lib/schema/conditions";
import type { FieldFindings } from "@/lib/audit/byField";
import { fieldIsInvalid } from "@/lib/audit/byField";
import { SEVERITY_LABELS } from "@/lib/audit/types";
import {
  MeasurementInput,
  MultiselectInput,
  SelectInput,
  TextInputField,
  TextareaField_,
  isSegmentedSelect
} from "./fields/inputs";
import { ToothPicker } from "./fields/ToothPicker";
import { SurfacePicker } from "./fields/SurfacePicker";
import { SectionReview } from "./SectionReview";
import {
  nextSectionKey,
  reviewSection,
  sectionSignature
} from "@/lib/review/sectionReview";

// A single labelable control gets an id so the visible label can name it via
// htmlFor. Group-style fields (chips, pickers, segmented selects) are named
// by aria-label on the group instead — and must NOT get htmlFor, because a
// label pointed at a button would activate it, changing a clinical value.
/** Does this stored value actually hold anything? Mirrors the audit's own test. */
function isEmptyValue(v: FieldValue): boolean {
  switch (v.kind) {
    case "select":
      return v.value.trim() === "";
    case "multiselect":
      return v.values.length === 0;
    case "text":
      return v.value.trim() === "";
    case "teeth":
      return v.teeth.length === 0;
    case "surfaces":
      return Object.keys(v.byTooth).length === 0;
    case "measurement":
      return v.value === null;
  }
}

function controlId(moduleId: string, field: Field): string | undefined {
  const labelable =
    field.type === "text" ||
    field.type === "textarea" ||
    field.type === "measurement" ||
    (field.type === "select" && !isSegmentedSelect(field));
  return labelable ? `ctl-${fieldKey(moduleId, field.id)}` : undefined;
}

function FieldRenderer({
  moduleId,
  field,
  state,
  onChange,
  describedBy,
  invalid,
  required
}: {
  moduleId: string;
  field: Field;
  state: NoteState;
  onChange: (key: string, value: FieldValue) => void;
  describedBy?: string;
  invalid?: boolean;
  /** Drives the omission-licence chips on free-text fields. See inputs.tsx. */
  required?: boolean;
}) {
  const key = fieldKey(moduleId, field.id);
  const value = state.values[key];
  const set = (v: FieldValue) => onChange(key, v);
  const a = { describedBy, invalid, required, id: controlId(moduleId, field) };

  switch (field.type) {
    case "select":
      return <SelectInput field={field} value={value?.kind === "select" ? value : undefined} onChange={set} {...a} />;
    case "multiselect":
      return <MultiselectInput field={field} value={value?.kind === "multiselect" ? value : undefined} onChange={set} {...a} />;
    case "text":
      return <TextInputField field={field} value={value?.kind === "text" ? value : undefined} onChange={set} {...a} />;
    case "textarea":
      return <TextareaField_ field={field} value={value?.kind === "text" ? value : undefined} onChange={set} {...a} />;
    case "toothPicker":
      return <ToothPicker field={field} value={value?.kind === "teeth" ? value : undefined} onChange={set} {...a} />;
    case "surfacePicker": {
      const linked = state.values[fieldKey(moduleId, field.linkedToothFieldId)];
      const linkedTeeth = linked?.kind === "teeth" ? linked.teeth : [];
      return (
        <SurfacePicker
          field={field}
          linkedTeeth={linkedTeeth}
          value={value?.kind === "surfaces" ? value : undefined}
          onChange={set}
          {...a}
        />
      );
    }
    case "measurement":
      return <MeasurementInput field={field} value={value?.kind === "measurement" ? value : undefined} onChange={set} {...a} />;
  }
}

export function NoteForm({
  modules,
  state,
  onChange,
  findingsByField = {},
  clinicalRole
}: {
  modules: ModuleDef[];
  state: NoteState;
  onChange: (key: string, value: FieldValue) => void;
  findingsByField?: FieldFindings;
  /**
   * REQUIRED, with no default, and that is the point.
   *
   * This prop used to default to "unset" — the value that restricts nothing —
   * and BuilderShell did not pass it. So every scope lock below was dead in the
   * only screen that renders this form: an assistant or hygienist saw
   * Assessment and Plan wide open, typed a diagnosis into them, and learned the
   * rule 1.5 seconds later when the server refused the autosave with a bare
   * "Save failed (403)." and stopped retrying. The permissive default is what
   * made that silent, and a required prop is what makes it unrepeatable — an
   * omitted scope is now a compile error rather than an unlocked record.
   */
  clinicalRole: ClinicalRole;
}) {
  // WHICH SECTIONS START OPEN.
  //
  // Universal Core alone is eleven sections and around sixty controls. Rendered
  // all at once that is roughly nine thousand pixels of form, and putting the
  // builder on the home page made it the first thing anyone sees after signing
  // in — which is the "too busy" problem moved rather than solved.
  //
  // So: prose first, structure on demand. The narrative opens; a section with
  // something already in it opens, because hiding a person's own work is worse
  // than showing too much; a section carrying an audit finding opens, because
  // that is the one the writer is being asked to look at. Everything else is a
  // one-line summary with its open-required count, ready when it is wanted.
  //
  // Computed ONCE, lazily, and then owned by the user. Deriving `open` on every
  // render would re-open a section the moment its first value was typed —
  // including one the writer had just deliberately collapsed.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const mod of modules) {
      for (const section of mod.sections) {
        const key = `${mod.id}.${section.id}`;
        const hasValue = section.fields.some((f) => {
          const v = state.values[fieldKey(mod.id, f.id)];
          return v !== undefined && !isEmptyValue(v);
        });
        // "required.missing" is excluded on purpose. On a brand-new note every
        // required field raises one, so counting them would open ten of eleven
        // sections and the collapse would do nothing at all on the one screen
        // it exists for. An empty note is not a note with problems; it is an
        // empty note. Any OTHER finding means something in here has been
        // written and needs a second look, which is worth opening for.
        const hasIssue = section.fields.some((f) =>
          (findingsByField[fieldKey(mod.id, f.id)] ?? []).some(
            (finding) => finding.ruleId !== "required.missing"
          )
        );
        initial[key] = section.id === "narrative" || hasValue || hasIssue;
      }
    }
    return initial;
  });

  // THE SECTION LOOP.
  //
  // `reviewed` maps a section key to the SIGNATURE of its contents at the
  // moment it was accepted, not to `true`. That is what makes the tick honest:
  // edit the section afterwards and the signature moves, the tick drops, and it
  // asks to be checked again — because "I read this and it was right" was said
  // about words that have since changed.
  //
  // `reviewing` is the one section currently showing its findings. One at a
  // time on purpose: the loop is write-check-accept-next, and three panels open
  // at once is the wall of feedback this replaced.
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Open a section, scroll to it, and put the cursor in its first control.
  // Landing somebody at the top of the next section without focus means they
  // have to find their place again, which is most of what "and continue" was
  // supposed to save them.
  const goToSection = (key: string) => {
    setOpenSections((s) => ({ ...s, [key]: true }));
    // After the open state has painted, or scrollIntoView measures a collapsed
    // element and scrolls to the wrong place.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`details[data-section="${key}"]`);
      if (!el) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      el.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
    });
  };

  // The sections of one module. Extracted so the two module wrappers below —
  // a real disclosure when there is more than one module, a plain box when
  // Universal Core is on its own — render identical content.
  const sectionsFor = (mod: ModuleDef) => (
    <>
      {mod.sections.map((section) => {
              // Diagnosis and treatment planning are the dentist's, by law, not
              // by seniority. Locked rather than hidden: a hygienist needs to
              // SEE what the dentist assessed to do their own work, and a
              // section that vanishes reads as a bug rather than as a rule.
              const outOfScope =
                !canRecordClinicalJudgement(clinicalRole) &&
                isDentistOwnedSection(mod.id, section.id);
              const sectionKey = `${mod.id}.${section.id}`;
              const signature = sectionSignature(mod, section, state);
              const open = openSections[sectionKey] ?? true;
              // What the summary line has to earn its collapse: how much of
              // this section is still outstanding. A closed section that says
              // nothing is a section people forget, which is precisely how a
              // required field goes unnoticed until the submit is refused.
              const openRequired = section.fields.filter(
                (f) =>
                  isFieldVisible(f, mod.id, state) &&
                  isFieldRequired(f, mod.id, state) &&
                  (() => {
                    const v = state.values[fieldKey(mod.id, f.id)];
                    return v === undefined || isEmptyValue(v);
                  })()
              ).length;
              // Excludes required.missing, which openRequired above already
              // counts. Counting both made an untouched section read
              // "2 to review · 2 required" about the SAME two empty fields —
              // one state, two badges, twice the alarm.
              const findingCount = section.fields.reduce(
                (n, f) =>
                  n +
                  (findingsByField[fieldKey(mod.id, f.id)] ?? []).filter(
                    (finding) => finding.ruleId !== "required.missing"
                  ).length,
                0
              );
              return (
              <details
                key={section.id}
                open={open}
                // Read the element BEFORE handing anything to setState.
                //
                // This used to dereference `e.currentTarget` inside the
                // functional updater, and React does not run that updater
                // synchronously — it runs during the next render, by which time
                // it has nulled currentTarget on the pooled event. Any toggle
                // that landed in the same batch as a re-render therefore threw
                // "Cannot read properties of null (reading 'open')" and the
                // error boundary swallowed the whole page.
                //
                // Adding an add-on module was exactly that batch: it changes
                // how many modules render, which remounts these <details>, which
                // fires toggle on the way. So every Fast Lane card looked like a
                // dead link.
                onToggle={(e) => {
                  const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                  setOpenSections((s) => ({ ...s, [sectionKey]: isOpen }));
                }}
                // The anchor the audit panel's "go to field" walks up to when
                // the field it wants is inside a collapsed section.
                data-section={sectionKey}
                className="rounded-lg border border-slate-200"
              >
                {/* label-section, not the old `text-xs font-bold uppercase
                    tracking-wide text-slate-500`. This is the most-read label in
                    the app — every section of every note passes through it — and
                    it was shouted, shrunk and greyed all at once, so it was both
                    the loudest thing on the row and the hardest part of it to
                    read. Sentence case at text-sm also gives the disclosure a
                    bigger tap target, which it needed on a phone anyway. */}
                <summary className="label-section flex cursor-pointer select-none list-none items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <span>
                    {section.title}
                    {outOfScope && (
                      <span className="ml-2 font-normal text-amber-800">
                        — dentist records this
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 font-normal">
                    {/* A collapsed section has to say whether it is done, or the
                        loop is invisible the moment you move past it. */}
                    {reviewed[sectionKey] === signature && (
                      <span className="rounded-full bg-green-100 px-1.5 text-[0.7rem] font-semibold text-green-900">
                        ✓ checked
                      </span>
                    )}
                    {findingCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-1.5 text-[0.7rem] font-semibold text-amber-900">
                        {findingCount} to review
                      </span>
                    )}
                    {openRequired > 0 && (
                      <span className="rounded-full bg-orange-100 px-1.5 text-[0.7rem] font-semibold text-orange-900">
                        {openRequired} required
                      </span>
                    )}
                    <span aria-hidden className="text-slate-400">
                      {open ? "▾" : "▸"}
                    </span>
                  </span>
                </summary>
                <fieldset disabled={outOfScope} className="px-3 pb-3">
                {outOfScope && (
                  <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    {scopeExplanation(clinicalRole)}
                  </p>
                )}
                <div className="space-y-3">
                  {section.fields.map((field) => {
                    if (!isFieldVisible(field, mod.id, state)) return null;
                    const required = isFieldRequired(field, mod.id, state);
                    const key = fieldKey(mod.id, field.id);
                    const findings = findingsByField[key];
                    const invalid = fieldIsInvalid(findings);
                    const helpId = field.helpText ? `${key}-help` : undefined;
                    const errId = findings?.length ? `${key}-err` : undefined;
                    const describedBy = [helpId, errId].filter(Boolean).join(" ") || undefined;
                    return (
                      <div key={field.id} id={`field-${mod.id}-${field.id}`}>
                        <label className="field-label" htmlFor={controlId(mod.id, field)}>
                          {field.label}
                          {required && <span className="ml-1 text-red-600" aria-hidden>*</span>}
                          {required && <span className="sr-only"> (required)</span>}
                        </label>
                        <FieldRenderer
                          moduleId={mod.id}
                          field={field}
                          state={state}
                          onChange={onChange}
                          describedBy={describedBy}
                          invalid={invalid}
                          required={required}
                        />
                        {field.helpText && (
                          <p id={helpId} className="mt-1 text-xs text-slate-500">{field.helpText}</p>
                        )}
                        {findings?.length ? (
                          <ul id={errId} className="mt-1 space-y-0.5" role={invalid ? "alert" : undefined}>
                            {findings.map((f, i) => (
                              <li key={i} className="text-xs text-rose-700">
                                {SEVERITY_LABELS[f.severity]}: {f.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {/* THE LOOP, at the end of the section it is about. */}
                <SectionReview
                  review={reviewSection(mod, section, state, findingsByField, clinicalRole)}
                  phase={
                    reviewed[sectionKey] === signature
                      ? "checked"
                      : reviewing === sectionKey
                        ? "reviewing"
                        : "idle"
                  }
                  hasNext={nextSectionKey(modules, sectionKey, clinicalRole) !== null}
                  canEdit={!outOfScope}
                  onCheck={() => setReviewing(sectionKey)}
                  onApply={(key, next) => onChange(key, { kind: "text", value: next })}
                  onKeepEditing={() => setReviewing(null)}
                  onAcceptAndContinue={() => {
                    // Recorded against the CONTENT, so a later edit un-checks it.
                    setReviewed((r) => ({ ...r, [sectionKey]: signature }));
                    setReviewing(null);
                    const next = nextSectionKey(modules, sectionKey, clinicalRole);
                    if (next) {
                      // Collapse the one just finished. The note gets shorter as
                      // it gets more complete, which is the opposite of what a
                      // long form usually does to a person.
                      setOpenSections((s) => ({ ...s, [sectionKey]: false }));
                      goToSection(next);
                    }
                  }}
                />
                </fieldset>
              </details>
              );
      })}
    </>
  );

  return (
    <div className="space-y-4">
      {modules.map((mod) => (
        // On a Core-only note the module header was 74px saying "the always-on
        // module is on" — a disclosure with a hard-coded `open` and one child is
        // not a disclosure, it is a label. It earns its place only once there is
        // more than one module to tell apart.
        //
        // A plain <div> in that case, NOT a headless <details>: a <details> with
        // no <summary> makes the browser supply its own, and every engine
        // renders the word "Details" with a disclosure triangle. Hiding the
        // summary swapped a redundant module title for a meaningless one.
        modules.length > 1 ? (
        <details key={mod.id} open className="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
              <summary className="cursor-pointer select-none rounded-t-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
                {mod.title}
              </summary>
              {mod.description && (
                <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
                  {mod.description}
                </p>
              )}
          <div className="space-y-5 px-4 py-4">{sectionsFor(mod)}</div>
        </details>
        ) : (
          <div key={mod.id} className="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
            <div className="space-y-5 px-4 py-4">{sectionsFor(mod)}</div>
          </div>
        )
      ))}
    </div>
  );
}
