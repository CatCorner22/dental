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

  // Lock the page behind the dialog. `overflow: hidden` on <body> alone is
  // not enough — iOS Safari ignores it for touch scrolling, and the page
  // drifts away behind the modal. Pinning the body with position:fixed at a
  // negative offset is the technique that actually holds there; the scroll
  // position is captured and restored so closing the dialog does not fling
  // the user back to the top of a long note.
  //
  // Only the OUTERMOST dialog touches the body: a stacked dialog would
  // otherwise capture an already-zeroed scroll position and restore that.
  useEffect(() => {
    if (openDialogs.length > 1) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
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
    // Scroll container outside, centring flexbox inside. A dialog taller than
    // the phone scrolls to reveal its own buttons; a short one stays centred.
    // Sizing the panel itself to the viewport instead would put the buttons of
    // a tall dialog off-screen with no way to reach them.
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/50"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      {/* min-h-full, not h-full: it grows with a tall panel rather than
          clipping it. The mouse-down target check lives on both layers so a
          click on the padding still counts as "outside". */}
      <div
        className="flex min-h-full items-center justify-center p-4"
        onMouseDown={(e) => {
          if (dismissible && e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                // -m-1 p-2 keeps the visual size but gives the finger a real
                // target; a bare ✕ glyph is well under any usable tap size.
                className="-m-1 shrink-0 rounded p-2 text-slate-600 hover:text-slate-900"
                aria-label="Close dialog"
              >
                ✕
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
