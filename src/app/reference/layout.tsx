import Link from "next/link";
import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";

export const runtime = "nodejs";

const LINKS = [
  { href: "/reference/templates", label: "Templates" },
  { href: "/reference/terminology", label: "Terminology & style" },
  { href: "/reference/abbreviations", label: "Abbreviation rules" },
  { href: "/reference/tooth-chart", label: "Tooth chart" },
  { href: "/reference/sedation-imaging", label: "Sedation & imaging" },
  { href: "/reference/tennessee-law", label: "Tennessee law" },
  { href: "/reference/data-hygiene", label: "Data Hygiene Guide" }
];

// The reference pages were the only family relying on middleware alone. The
// project's own rule (guards.ts) is that middleware is convenience and every
// route checks for itself, so one guard here covers all eight routes. The
// content is internal training material rather than patient data, but a page
// whose protection lives in exactly one place is a page that loses it the day
// someone edits the matcher.
export default async function ReferenceLayout({ children }: { children: React.ReactNode }) {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav className="flex shrink-0 flex-row flex-wrap gap-1 md:w-52 md:flex-col">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="tap rounded px-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
