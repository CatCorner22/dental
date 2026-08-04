"use client";

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

// A single labelable control gets an id so the visible label can name it via
// htmlFor. Group-style fields (chips, pickers, segmented selects) are named
// by aria-label on the group instead — and must NOT get htmlFor, because a
// label pointed at a button would activate it, changing a clinical value.
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
  invalid
}: {
  moduleId: string;
  field: Field;
  state: NoteState;
  onChange: (key: string, value: FieldValue) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const key = fieldKey(moduleId, field.id);
  const value = state.values[key];
  const set = (v: FieldValue) => onChange(key, v);
  const a = { describedBy, invalid, id: controlId(moduleId, field) };

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
  return (
    <div className="space-y-4">
      {modules.map((mod) => (
        <details key={mod.id} open className="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
          <summary className="cursor-pointer select-none rounded-t-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
            {mod.title}
          </summary>
          {mod.description && (
            <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">{mod.description}</p>
          )}
          <div className="space-y-5 px-4 py-4">
            {mod.sections.map((section) => {
              // Diagnosis and treatment planning are the dentist's, by law, not
              // by seniority. Locked rather than hidden: a hygienist needs to
              // SEE what the dentist assessed to do their own work, and a
              // section that vanishes reads as a bug rather than as a rule.
              const outOfScope =
                !canRecordClinicalJudgement(clinicalRole) &&
                isDentistOwnedSection(mod.id, section.id);
              return (
              <fieldset key={section.id} disabled={outOfScope}>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {section.title}
                  {outOfScope && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-amber-800">
                      — dentist records this
                    </span>
                  )}
                </legend>
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
              </fieldset>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
