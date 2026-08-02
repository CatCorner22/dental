"use client";

import { useEffect, useId, useRef } from "react";

function focusables(node: HTMLElement | null): HTMLElement[] {
  return Array.from(
    node?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    ) ?? []
  );
}

// When dialogs stack, only the one on top of this stack answers ESC —
// otherwise a single keypress closes all of them at once.
const openDialogs: symbol[] = [];

// Accessible modal: focus trap, ESC to close, focus return, labelled title.
// dismissible={false} removes every close affordance (✕, ESC, backdrop) for
// gates that require an explicit choice, like the legal-record notice.
export function Dialog({
  title,
  onClose,
  children,
  dismissible = true
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const id = useRef<symbol>(Symbol("dialog"));
  // Unique per instance: dialogs can stack (conflict over PHI override), and
  // a shared hardcoded id would make aria-labelledby resolve to whichever
  // title appears first in the document — announcing the wrong dialog.
  const titleId = useId();

  // Mount-only: remember the opener, register in the stack, and move focus in
  // ONCE. Keyed on nothing, so parent re-renders (which recreate inline
  // onClose handlers) can neither yank focus mid-typing nor corrupt the
  // focus-return target.
  useEffect(() => {
    const self = id.current;
    openDialogs.push(self);
    returnTo.current = document.activeElement as HTMLElement | null;
    focusables(ref.current)[0]?.focus();
    return () => {
      const i = openDialogs.indexOf(self);
      if (i >= 0) openDialogs.splice(i, 1);
      returnTo.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id.current) return; // not topmost
      if (e.key === "Escape") {
        if (!dismissible) return;
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const items = focusables(ref.current);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        // Clicking non-focusable dialog text moves focus to <body>; without
        // this, the next Tab walks into the inert background page.
        if (!active || !ref.current?.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, dismissible]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
