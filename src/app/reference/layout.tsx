import Link from "next/link";

const LINKS = [
  { href: "/reference/templates", label: "Templates" },
  { href: "/reference/terminology", label: "Terminology & style" },
  { href: "/reference/abbreviations", label: "Abbreviation rules" },
  { href: "/reference/tooth-chart", label: "Tooth chart" },
  { href: "/reference/sedation-imaging", label: "Sedation & imaging" },
  { href: "/reference/tennessee-law", label: "Tennessee law" }
];

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav className="flex shrink-0 flex-row flex-wrap gap-1 md:w-52 md:flex-col">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
