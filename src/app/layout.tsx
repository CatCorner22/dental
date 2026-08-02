import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/repo/users";
import { AppHeader } from "@/components/shell/AppHeader";
import { NoticeGate } from "@/components/notice/NoticeGate";
import "./globals.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Dental Note Builder",
  description:
    "Standardized, de-identified dental note drafts with a deterministic audit pass. No patient identifiers ever enter this tool."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // The ack flag only ever goes false -> true, so we only need the fresh DB
  // read when the (possibly stale) token still says "not acked". A deleted
  // user is treated as acked so the gate can never get stuck open.
  let noticeAcked = session?.user?.noticeAcked ?? true;
  if (session?.user && !noticeAcked) {
    const db = await getDb();
    const row = await getUserById(db, session.user.id);
    noticeAcked = !row || row.noticeAckAt != null;
  }
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-blue-700 focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <AppHeader user={session?.user ?? null} />
        {session?.user && <NoticeGate acknowledged={noticeAcked} />}
        <main id="main" className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-xs leading-relaxed text-slate-500">
          <p>
            This tool standardizes documentation wording and order. It is deterministic — it makes
            no AI calls and stores no patient data. It does not diagnose, select treatment,
            calculate doses, assign billing codes, or determine discharge readiness. A licensed
            clinician must compare every fact with the source record, resolve every audit finding,
            and sign in the EDR. Reference summaries are internal training aids, not legal advice.
          </p>
        </footer>
      </body>
    </html>
  );
}
