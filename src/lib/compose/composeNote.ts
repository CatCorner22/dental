import type { Field, FieldValue, ModuleDef, NoteState, Surface, ToothId } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible, isValueEmpty } from "@/lib/schema/conditions";
import { describeTeeth } from "@/lib/vocab/teeth";
import { formatSurfaces } from "@/lib/vocab/surfaces";

// The composer walks modules in canonical order, so every note comes out in
// the same standardized sequence no matter how it was entered.
// Empty optional fields are omitted: a blank never silently becomes normal,
// and required blanks surface as audit findings instead.

// Neutralize markdown structure in user-entered free text so a typed
// "## Submission record" or "---" can never forge a heading or thematic
// break in the frozen note or audit report (the real stamp uses those exact
// markers). Only leading structural tokens are escaped; ordinary content,
// including dashes used as bullets mid-line, is untouched.
function sanitizeUserText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) return line.replace(/^(\s{0,3})(#)/, "$1\\$2");
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) return line.replace(/^(\s{0,3})([-*_])/, "$1\\$2");
      return line;
    })
    .join("\n");
}

function formatValue(field: Field, value: FieldValue): string {
  switch (value.kind) {
    case "select":
      // Option values are sanitized too, not just the "other" free text: a
      // tampered client can PATCH any string into a select, and drafts stored
      // before option-set validation existed may still hold one.
      return value.value === "__other__"
        ? sanitizeUserText((value.otherText ?? "").trim())
        : sanitizeUserText(value.value);
    case "multiselect": {
      const joiner = field.type === "multiselect" ? (field.joiner ?? "; ") : "; ";
      // Compose in the field's canonical option order, not the user's click
      // order, so the same selections always render identically (standard work).
      const order =
        field.type === "multiselect"
          ? new Map(field.options.map((o, i) => [o.value, i]))
          : null;
      const values = order
        ? [...value.values].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
        : value.values;
      return values.map(sanitizeUserText).join(joiner);
    }
    case "text":
      return sanitizeUserText(value.value.trim());
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

export interface NoteContext {
  /** The office this encounter happened at, already resolved to a name. */
  officeName?: string | null;
}

export function composeNote(
  state: NoteState,
  modules: ModuleDef[],
  context: NoteContext = {}
): string {
  const lines: string[] = ["# De-identified Smile Note draft", ""];
  // Location goes at the TOP, with the encounter identity, not in the footer.
  // A reader checking they have the right chart open scans the first lines;
  // "which office was this" is part of that check, and a wrong-office paste is
  // exactly the error the header exists to make visible. Omitted entirely when
  // unknown, rather than printed as "Unknown" — a placeholder reads like a
  // finding about the visit instead of a gap in the record.
  if (context.officeName) {
    lines.push(`**Office:** ${context.officeName}`, "");
  }
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
export function composeNoteText(
  state: NoteState,
  modules: ModuleDef[],
  context: NoteContext = {}
): string {
  return composeNote(state, modules, context)
    .replace(/^#{1,3} /gm, "")
    .replace(/^- /gm, "  ")
    // The office line is bold in markdown; the plain-text copy is what gets
    // pasted into Curve Hero, so the asterisks must not travel with it.
    .replace(/^\*\*(.+?):\*\* /gm, "$1: ");
}

export function suggestedFilename(state: NoteState, modules: ModuleDef[]): string {
  const active = modules
    .filter((m) => !m.alwaysOn && state.selectedModuleIds.includes(m.id))
    .sort((a, b) => a.order - b.order);
  const slug = active.length === 0 ? "universal-core" : active[0].id;
  return `dental-note-draft-${slug}`;
}
