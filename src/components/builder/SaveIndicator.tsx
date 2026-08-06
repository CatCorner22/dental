"use client";

import type { AutosaveState } from "@/lib/client/autosaveMachine";
import { Character } from "@/components/mascot/Sparkle";

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
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}
      role="status"
      aria-live="polite"
    >
      {/* Sparkle turns up for the good news only. On "saving", "dirty" or an
          error she would be decorating a state the writer needs to read. */}
      {state.status === "saved" && <Character id="sparkle" size="xs" />}
      {text}
    </span>
  );
}
