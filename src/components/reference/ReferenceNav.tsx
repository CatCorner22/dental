"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The reference sidebar. Client-side for exactly one reason: the active link
// needs the current pathname, and aria-current is the accessible way to say
// "you are here" — the only nav in the app without it was this one.
//
// The links are GROUPED because thirteen flat entries made every visit a
// re-scan. The groups follow who reaches for the page: writing a note,
// standing chairside, answering "who says so", running the deployment.
const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Writing",
    links: [
      { href: "/reference/templates", label: "Templates" },
      { href: "/reference/terminology", label: "Terminology & style" },
      { href: "/reference/abbreviations", label: "Abbreviation rules" },
      { href: "/reference/shorthand", label: "Shorthand expansions" },
      { href: "/reference/word-map", label: "Word map" }
    ]
  },
  {
    label: "Chairside",
    links: [
      { href: "/reference/tooth-chart", label: "Tooth chart" },
      { href: "/reference/sedation-imaging", label: "Sedation & imaging" },
      { href: "/reference/curve-hero-header", label: "Curve Hero header" }
    ]
  },
  {
    label: "Rules and safety",
    links: [
      { href: "/reference/tennessee-law", label: "Tennessee law" },
      { href: "/reference/risk-management", label: "Risk management" },
      { href: "/reference/data-hygiene", label: "Data Hygiene Guide" },
      { href: "/reference/source-ledger", label: "Evidence and sources" }
    ]
  },
  {
    label: "Operations",
    links: [{ href: "/reference/deployment", label: "Deployment" }]
  }
];

export function ReferenceNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Reference pages"
      className="card p-3 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:w-56 md:shrink-0 md:self-start md:overflow-y-auto"
    >
      <div className="flex flex-row flex-wrap gap-x-6 gap-y-3 md:flex-col md:gap-y-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="min-w-36">
            <p className="label-micro mb-1">{g.label}</p>
            <ul className="space-y-0.5">
              {g.links.map((l) => {
                const active = pathname === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`tap block rounded-lg px-2.5 py-1 text-sm ${
                        active
                          ? "bg-brand-navy font-semibold text-white shadow-sm"
                          : "font-medium text-slate-700 hover:bg-brand-navy/10 hover:text-brand-navy"
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
