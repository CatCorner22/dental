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
            className={`font-medium hover:text-slate-900 ${active ? "text-blue-700 underline" : "text-slate-700"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
