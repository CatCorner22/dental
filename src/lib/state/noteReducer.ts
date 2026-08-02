import type { FieldValue, NoteState, Surface, ToothId } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isValueEmpty } from "@/lib/schema/conditions";
import { MODULES_BY_ID } from "@/lib/modules";

export type NoteAction =
  | { type: "toggleModule"; moduleId: string }
  | { type: "setValue"; key: string; value: FieldValue }
  | { type: "clearValue"; key: string }
  | { type: "clearModule"; moduleId: string }
  | { type: "reset" };

export const initialNoteState: NoteState = {
  selectedModuleIds: [],
  values: {}
};

function pruneOrphanSurfaces(
  values: Record<string, FieldValue>,
  toothKey: string,
  teeth: ToothId[]
): void {
  const separator = toothKey.indexOf(".");
  const moduleId = toothKey.slice(0, separator);
  const toothFieldId = toothKey.slice(separator + 1);
  const mod = MODULES_BY_ID.get(moduleId);
  if (!mod) return;
  for (const section of mod.sections) {
    for (const field of section.fields) {
      if (field.type !== "surfacePicker" || field.linkedToothFieldId !== toothFieldId) continue;
      const key = fieldKey(moduleId, field.id);
      const current = values[key];
      if (current?.kind !== "surfaces") continue;
      const kept: Record<ToothId, Surface[]> = {};
      for (const [tooth, surfaces] of Object.entries(current.byTooth)) {
        if (teeth.includes(tooth)) kept[tooth] = surfaces as Surface[];
      }
      values[key] = { kind: "surfaces", byTooth: kept };
    }
  }
}

export function noteReducer(state: NoteState, action: NoteAction): NoteState {
  switch (action.type) {
    case "toggleModule": {
      const selected = state.selectedModuleIds.includes(action.moduleId);
      if (!selected) {
        return { ...state, selectedModuleIds: [...state.selectedModuleIds, action.moduleId] };
      }
      const values = Object.fromEntries(
        Object.entries(state.values).filter(([key]) => !key.startsWith(`${action.moduleId}.`))
      );
      return {
        selectedModuleIds: state.selectedModuleIds.filter((id) => id !== action.moduleId),
        values
      };
    }
    case "setValue": {
      const values = { ...state.values };
      // An emptied field drops its key entirely, so a note the user cleared is
      // treated as empty by hasContent and the unsaved-work guard.
      if (isValueEmpty(action.value)) delete values[action.key];
      else values[action.key] = action.value;
      // Changing the tooth selection drops surfaces belonging to teeth that
      // are no longer listed, so the note can never assert work on a tooth it
      // does not name. The audit still stops any orphan that reaches it.
      if (action.value.kind === "teeth") {
        pruneOrphanSurfaces(values, action.key, action.value.teeth);
      }
      return { ...state, values };
    }
    case "clearValue": {
      const values = { ...state.values };
      delete values[action.key];
      return { ...state, values };
    }
    case "clearModule": {
      const values = Object.fromEntries(
        Object.entries(state.values).filter(([key]) => !key.startsWith(`${action.moduleId}.`))
      );
      return { ...state, values };
    }
    case "reset":
      return initialNoteState;
  }
}
