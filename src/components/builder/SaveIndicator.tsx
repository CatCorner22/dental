"use client";

import type { AutosaveState } from "@/lib/client/autosaveMachine";
import { Character } from "@/components/mascot/Sparkle";

// WHAT A FAILED SAVE HAS TO SAY.
//
// The error branch used to print the server's sentence where "All changes
// saved" had been, in the same grey row, and stop. Two things a writer needs
// were missing from that, and they are the only two that matter at the moment
// a save fails: the words are still on this screen and nothing has been lost,
// and the app is already trying again. Without the first, the reasonable
// response to a red line under a half-written note is to stop typing; without
// the second, it is to keep pressing Save. `onRetry` adds the third — a way to
// stop waiting out the four-second backoff.
export function SaveIndicator({
  state,
  onRetry
}: {
  state: AutosaveState;
  onRetry?: () => void;
}) {
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
      className={`inline-flex flex-wrap items-center gap-1 text-xs font-medium ${cls}`}
      role="status"
      aria-live="polite"
    >
      {/* Sparkle turns up for the good news only. On "saving", "dirty" or an
          error she would be decorating a state the writer needs to read. */}
      {state.status === "saved" && <Character id="sparkle" size="xs" />}
      {text}
      {state.status === "error" && (
        <>
          <span className="font-normal text-slate-600">
            Nothing is lost — your note is still on this screen, and Smile Notes keeps trying.
          </span>
          {onRetry && (
            <button
              type="button"
              className="rounded px-1 font-semibold text-brand-blue underline"
              onClick={onRetry}
            >
              Try now
            </button>
          )}
        </>
      )}
    </span>
  );
}
