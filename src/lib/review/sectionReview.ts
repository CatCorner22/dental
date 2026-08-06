import type { AuditFinding } from "@/lib/audit/types";
import type { FieldFindings } from "@/lib/audit/byField";
import type { Field, FieldValue, ModuleDef, NoteState, SectionDef } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldRequired, isFieldVisible, isValueEmpty } from "@/lib/schema/conditions";
import { standardize } from "@/lib/standardize/standardize";
import { isDentistOwnedSection, canRecordClinicalJudgement } from "@/lib/auth/clinicalRoles";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";

/**
 * WRITE A SECTION, CHECK IT, MOVE ON.
 *
 * The note used to be one long form with a live audit beside it, which asks a
 * writer to hold the whole document in their head and decide for themselves
 * when any part of it is finished. This turns it into a loop with a shape:
 * write this section, ask the deterministic tools what they make of it, accept
 * or change what they say, and go to the next one.
 *
 * Everything here is pure and takes the note as an argument, so the rule for
 * "what does this section still need" is testable without a browser and cannot
 * drift between the summary badge and the review panel — they call the same
 * function.
 *
 * NOTHING HERE APPLIES ANYTHING. reviewSection reports; the component decides,
 * and only after a person presses a button.
 */

/** A wording change the deterministic pass would make, offered for approval. */
export interface SectionProposal {
  /** `moduleId.fieldId` — the key onChange writes to. */
  fieldKey: string;
  /** The field's label, so the offer can say which box it is about. */
  label: string;
  before: string;
  after: string;
}

/** A required field in this section that is still empty. */
export interface OpenRequirement {
  fieldKey: string;
  label: string;
}

export interface SectionReview {
  proposals: SectionProposal[];
  /**
   * Findings raised against this section's fields, excluding required.missing —
   * an empty required field is reported as an OpenRequirement instead, because
   * "fill this in" and "look again at what you wrote" are different requests
   * and stacking them double-counts one empty box.
   */
  findings: AuditFinding[];
  openRequired: OpenRequirement[];
  /** True when this section cannot be called done: a required field is empty. */
  blocked: boolean;
  /** Nothing proposed, nothing flagged, nothing missing. */
  clean: boolean;
}

/** Free text this module can standardize. Pickers and selects have no prose. */
function textOf(value: FieldValue | undefined): string | null {
  if (!value) return null;
  return value.kind === "text" ? value.value : null;
}

function editableFields(
  mod: ModuleDef,
  section: SectionDef,
  state: NoteState,
  clinicalRole: ClinicalRole
): Field[] {
  // A locked section is somebody else's to write. Proposing edits into it would
  // offer a button whose only outcome is a 403 on the next autosave.
  if (!canRecordClinicalJudgement(clinicalRole) && isDentistOwnedSection(mod.id, section.id)) {
    return [];
  }
  return section.fields.filter((f: Field) => isFieldVisible(f, mod.id, state));
}

export function reviewSection(
  mod: ModuleDef,
  section: SectionDef,
  state: NoteState,
  findingsByField: FieldFindings,
  clinicalRole: ClinicalRole
): SectionReview {
  const proposals: SectionProposal[] = [];
  const findings: AuditFinding[] = [];
  const openRequired: OpenRequirement[] = [];

  for (const field of editableFields(mod, section, state, clinicalRole)) {
    const key = fieldKey(mod.id, field.id);
    const value = state.values[key];

    if (isFieldRequired(field, mod.id, state) && (value === undefined || isValueEmpty(value))) {
      openRequired.push({ fieldKey: key, label: field.label });
    }

    for (const f of findingsByField[key] ?? []) {
      if (f.ruleId !== "required.missing") findings.push(f);
    }

    const text = textOf(value);
    if (text && text.trim()) {
      const r = standardize(text);
      // A truncated result would silently delete everything past 20,000
      // characters if it were ever applied, so it is never offered. Same
      // refusal the per-field chip makes, for the same reason.
      if (!r.truncated && r.text !== text) {
        proposals.push({ fieldKey: key, label: field.label, before: text, after: r.text });
      }
    }
  }

  return {
    proposals,
    findings,
    openRequired,
    blocked: openRequired.length > 0,
    clean: proposals.length === 0 && findings.length === 0 && openRequired.length === 0
  };
}

/**
 * A fingerprint of everything this section currently holds.
 *
 * A section is marked reviewed against its CONTENT, not for all time. Edit it
 * afterwards and the signature moves, the tick drops off, and it asks to be
 * checked again — which is the only honest behaviour, because "I read this and
 * it was right" was said about words that have since changed.
 */
export function sectionSignature(mod: ModuleDef, section: SectionDef, state: NoteState): string {
  return section.fields
    .map((f: Field) => {
      const v = state.values[fieldKey(mod.id, f.id)];
      return `${f.id}=${v === undefined ? "" : JSON.stringify(v)}`;
    })
    .join("|");
}

export const sectionKeyOf = (mod: ModuleDef, section: SectionDef) => `${mod.id}.${section.id}`;

/**
 * Every section a writer can actually reach, in the order they appear.
 *
 * Modules are sorted by their own `order` exactly as composeNote sorts them, so
 * "next" means next on the screen rather than next in whatever order the array
 * happened to arrive in.
 */
export function orderedSectionKeys(modules: ModuleDef[]): string[] {
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((mod) => mod.sections.map((section) => sectionKeyOf(mod, section)));
}

/**
 * Where "and continue" goes.
 *
 * Returns null at the end of the note — the caller shows the finish step
 * instead of scrolling somebody to nowhere. An unknown current key also returns
 * null rather than guessing at position 0, because silently jumping to the top
 * of the note is worse than not moving.
 *
 * Skips dentist-owned Assessment/Plan when the writer cannot record clinical
 * judgement. Landing a hygienist on a locked section made Accept-and-continue
 * open a panel with no Check button (`SectionReview` returns null when
 * `!canEdit`), so the loop looked broken.
 */
export function nextSectionKey(
  modules: ModuleDef[],
  current: string,
  clinicalRole: ClinicalRole = "unset"
): string | null {
  const keys = orderedSectionKeys(modules);
  const i = keys.indexOf(current);
  if (i === -1) return null;
  const canJudge = canRecordClinicalJudgement(clinicalRole);
  for (let j = i + 1; j < keys.length; j++) {
    const key = keys[j]!;
    // Keys are `${moduleId}.${sectionId}`; dentist-owned set uses that shape.
    const dot = key.indexOf(".");
    if (dot === -1) continue;
    const modId = key.slice(0, dot);
    const sectionId = key.slice(dot + 1);
    if (!canJudge && isDentistOwnedSection(modId, sectionId)) continue;
    return key;
  }
  return null;
}

/** How far through the note this writer is, for the progress line. */
export function reviewProgress(
  modules: ModuleDef[],
  reviewed: Record<string, string>,
  state: NoteState
): { done: number; total: number } {
  const bySection = new Map<string, { mod: ModuleDef; section: SectionDef }>();
  for (const mod of modules) {
    for (const section of mod.sections) bySection.set(sectionKeyOf(mod, section), { mod, section });
  }
  const keys = orderedSectionKeys(modules);
  let done = 0;
  for (const key of keys) {
    const entry = bySection.get(key);
    if (!entry) continue;
    // Counted only while the signature still matches — a section edited after
    // being checked is not a section that is done.
    if (reviewed[key] === sectionSignature(entry.mod, entry.section, state)) done += 1;
  }
  return { done, total: keys.length };
}
