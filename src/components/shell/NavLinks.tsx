"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  // Highlight when the path starts with this prefix instead of href — e.g.
  // "References" links to /reference/templates but owns all of /reference.
  activePrefix?: string;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const prefix = item.activePrefix ?? item.href;
        const active = prefix === "/" ? pathname === "/" : pathname.startsWith(prefix);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // The most-tapped controls in the app. Pills, not underlined
            // text: with a dozen destinations in the header, "where am I"
            // has to be answerable from three feet away, and a filled navy
            // pill is legible at a glance where an underline is not. The
            // forced-colors rule keys on aria-current, so the state
            // survives Windows High Contrast too.
            className={`tap rounded-full px-2 py-0.5 font-medium transition-colors duration-100 ${
              active
                ? "bg-brand-navy text-white shadow-sm"
                : "text-slate-700 hover:bg-brand-navy/10 hover:text-brand-navy"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
