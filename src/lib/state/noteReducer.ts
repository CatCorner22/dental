import type { FieldValue, NoteState } from "@/lib/schema/types";

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
    case "setValue":
      return { ...state, values: { ...state.values, [action.key]: action.value } };
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
