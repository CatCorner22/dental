import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dental Note Builder",
  description:
    "Standardized, de-identified dental note drafts with a deterministic audit pass. No patient identifiers ever enter this tool."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              🦷 Dental Note Builder
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="font-medium text-slate-700 hover:text-slate-900">
                Note builder
              </Link>
              <Link
                href="/reference/templates"
                className="font-medium text-slate-700 hover:text-slate-900"
              >
                References
              </Link>
            </nav>
          </div>
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
            De-identified drafts only. Never enter a patient name, exact date, contact detail,
            record number, or image. Complete identifiers only in the EDR.
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-xs leading-relaxed text-slate-500">
          <p>
            This tool standardizes documentation wording and order. It does not diagnose, select
            treatment, calculate doses, assign billing codes, or determine discharge readiness. A
            licensed clinician must compare every fact with the source record, resolve every
            audit finding, and sign in the EDR. Reference summaries are internal training aids,
            not legal advice; verify current law, Tennessee Rule 0460, payer rules, and facility
            policy.
          </p>
        </footer>
      </body>
    </html>
  );
}
