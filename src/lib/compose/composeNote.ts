import type { Field, FieldValue, ModuleDef, NoteState, Surface, ToothId } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible, isValueEmpty } from "@/lib/schema/conditions";
import { describeTeeth } from "@/lib/vocab/teeth";
import { formatSurfaces } from "@/lib/vocab/surfaces";

// The composer walks modules in canonical order, so every note comes out in
// the same standardized sequence no matter how it was entered.
// Empty optional fields are omitted: a blank never silently becomes normal,
// and required blanks surface as audit findings instead.

function formatValue(field: Field, value: FieldValue): string {
  switch (value.kind) {
    case "select":
      return value.value === "__other__" ? (value.otherText ?? "").trim() : value.value;
    case "multiselect": {
      const joiner = field.type === "multiselect" ? (field.joiner ?? "; ") : "; ";
      return value.values.join(joiner);
    }
    case "text":
      return value.value.trim();
    case "teeth":
      return describeTeeth(value.teeth);
    case "surfaces": {
      const parts = Object.entries(value.byTooth)
        .filter(([, surfaces]) => surfaces.length > 0)
        .map(([tooth, surfaces]) => `tooth ${tooth} (${formatSurfaces(surfaces as Surface[])})`);
      return parts.join("; ");
    }
    case "measurement":
      return value.value === null ? "" : `${value.value} ${value.unit}`;
  }
}

export function composeNote(state: NoteState, modules: ModuleDef[]): string {
  const lines: string[] = ["# De-identified dental note draft", ""];
  const ordered = [...modules].sort((a, b) => a.order - b.order);

  for (const mod of ordered) {
    const moduleLines: string[] = [];
    for (const section of mod.sections) {
      const sectionLines: string[] = [];
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, state)) continue;
        const value = state.values[fieldKey(mod.id, field.id)];
        if (isValueEmpty(value)) continue;
        const text = formatValue(field, value as FieldValue);
        if (!text) continue;
        sectionLines.push(`- ${field.label}: ${text}`);
      }
      if (sectionLines.length > 0) {
        sectionLines.unshift(`### ${section.title}`, "");
        sectionLines.push("");
        moduleLines.push(...sectionLines);
      }
    }
    if (moduleLines.length > 0) {
      lines.push(`## ${mod.title}`, "", ...moduleLines);
    }
  }

  lines.push(
    "---",
    "",
    "Complete identities, exact dates, times, signatures, permits, codes, and record links only in the EDR.",
    "A licensed clinician must compare every fact with the source record, resolve every flag, and sign in the EDR."
  );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

// Plain-text variant for .txt export: same content, markdown markers stripped.
export function composeNoteText(state: NoteState, modules: ModuleDef[]): string {
  return composeNote(state, modules)
    .replace(/^#{1,3} /gm, "")
    .replace(/^- /gm, "  ");
}

export function suggestedFilename(state: NoteState, modules: ModuleDef[]): string {
  const active = modules
    .filter((m) => !m.alwaysOn && state.selectedModuleIds.includes(m.id))
    .sort((a, b) => a.order - b.order);
  const slug = active.length === 0 ? "universal-core" : active[0].id;
  return `dental-note-draft-${slug}`;
}
