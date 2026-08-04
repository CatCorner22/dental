"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// LIGHTBULB HELP TIP — hover or focus shows a short tip; Escape closes.
// Visible text first; the icon is the affordance. Meets keyboard + pointer users.

export function HelpTip({
  label,
  children,
  side = "bottom"
}: {
  /** Accessible name for the tip trigger (e.g. "About license scope"). */
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex align-middle">
      <button
        type="button"
        className="tap-sq inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-700 ring-1 ring-amber-300/80 hover:bg-amber-50 focus-visible:outline-none"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <LightbulbIcon />
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className={`absolute z-40 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-brand-navy px-3 py-2 text-left text-xs leading-relaxed text-white shadow-lg ${
            side === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "left-1/2 top-full mt-2 -translate-x-1/2"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}

function LightbulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21h6M12 3a6 6 0 0 0-4 10.5V16a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.5A6 6 0 0 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
