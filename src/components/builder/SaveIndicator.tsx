"use client";

import type { AutosaveState } from "@/lib/client/autosaveMachine";

export function SaveIndicator({ state }: { state: AutosaveState }) {
  let text: string;
  let cls = "text-slate-500";
  switch (state.status) {
    case "idle":
      text = "All changes saved";
      break;
    case "dirty":
      text = "Unsaved changes";
      cls = "text-amber-700";
      break;
    case "saving":
      text = "Saving…";
      break;
    case "saved":
      text = `Saved ${new Date(state.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      cls = "text-green-700";
      break;
    case "conflict":
      text = "Newer version exists";
      cls = "text-rose-700";
      break;
    case "error":
      text = state.message;
      cls = "text-rose-700";
      break;
  }
  return (
    <span className={`text-xs font-medium ${cls}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}
