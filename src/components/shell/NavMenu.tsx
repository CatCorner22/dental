"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

export interface NavMenuItem {
  href: string;
  label: string;
  /** Highlight when the path starts with this instead of href. */
  activePrefix?: string;
  /** One line under the label, for destinations whose name is not self-evident. */
  hint?: string;
}

/**
 * The overflow menu behind the four primary nav pills.
 *
 * WHY THIS EXISTS. The header used to render up to twelve pills plus a name plus
 * a Sign out button on one wrapping row. Twelve equally-weighted destinations is
 * not navigation, it is a list — the eye has to read all of them to find one, on
 * every page, forever. Four pills carry the things a clinician touches while
 * working; everything else is administration and settings, which are visited
 * deliberately and can afford one extra click.
 *
 * Nothing is lost. Every destination and every role gate moved here verbatim.
 *
 * Built on <details>, not a custom popover: the browser gives us the open/close
 * state, the button semantics, and keyboard operation for free. The only things
 * added on top are the two dismissals a native disclosure does not do — ESC and
 * a click outside — because a menu that can only be closed by hitting the same
 * summary again feels stuck.
 */
export function NavMenu({
  items,
  identity
}: {
  items: NavMenuItem[];
  identity: string;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Return focus to the summary, or the close lands the user nowhere.
      ref.current?.querySelector("summary")?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  // Any navigation closes it. Without this the panel stays open over the page
  // it just navigated to, because the component never unmounts.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const anyActive = items.some((item) => {
    const prefix = item.activePrefix ?? item.href;
    return pathname.startsWith(prefix);
  });

  return (
    <details
      ref={ref}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="relative"
    >
      <summary
        // list-none + the marker rule kills the disclosure triangle in every
        // engine; Safari needs the ::-webkit-details-marker form.
        className={`tap flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors duration-100 [&::-webkit-details-marker]:hidden ${
          anyActive
            ? "bg-brand-navy text-white shadow-sm"
            : "text-slate-700 hover:bg-brand-navy/10 hover:text-brand-navy"
        }`}
        aria-label="More destinations"
      >
        More
        <span aria-hidden="true" className="text-[0.65em]">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
        <p className="truncate px-2.5 pb-1.5 pt-1 text-xs text-slate-500">{identity}</p>
        <ul className="border-t border-slate-100 pt-1.5">
          {items.map((item) => {
            const prefix = item.activePrefix ?? item.href;
            const active = pathname.startsWith(prefix);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`tap block rounded-lg px-2.5 py-1.5 text-sm ${
                    active
                      ? "bg-brand-navy/10 font-semibold text-brand-navy"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                  {item.hint ? (
                    <span className="block text-xs font-normal text-slate-500">{item.hint}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="tap block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </details>
  );
}
