"use client";

import { useEffect, useState } from "react";
import { SwitchAuthorButton } from "@/components/shell/SignOutButton";

const DEFAULT_IDLE_MS = 10 * 60 * 1000;

/**
 * Shared-tablet idle lock — Honest Finish / IT hate panel.
 *
 * After idle, force an authorship choice: Switch author (wipe + sign-out) or
 * confirm still the same person. Not MFA and not per-patient identity — residual
 * risk remains — but closes the silent walkaway hole Switch author alone missed.
 */
export function SharedTabletIdleLock({
  idleMs = DEFAULT_IDLE_MS,
  displayName
}: {
  idleMs?: number;
  displayName?: string;
}) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (locked) {
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setLocked(true), idleMs);
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "mousemove"
    ];
    for (const e of events) window.addEventListener(e, arm, { passive: true });
    arm();
    return () => {
      if (timer) clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, arm);
    };
  }, [idleMs, locked]);

  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-tablet-idle-title"
      onKeyDown={(e) => {
        // Keep typing from landing in the note under the overlay.
        e.stopPropagation();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-300 bg-white p-5 shadow-xl">
        <h2 id="shared-tablet-idle-title" className="text-lg font-semibold text-slate-900">
          Shared tablet idle
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {displayName ? `${displayName} — ` : ""}
          Confirm you are still the author, or switch before the next patient.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <SwitchAuthorButton className="tap btn-primary w-full justify-center text-sm" />
          <button
            type="button"
            className="tap btn-secondary w-full justify-center text-sm"
            onClick={() => setLocked(false)}
          >
            Still me — continue
          </button>
        </div>
      </div>
    </div>
  );
}
