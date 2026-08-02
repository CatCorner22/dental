import type { Metadata, Viewport } from "next";
import { auth } from "@/lib/auth/auth";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { AppHeader } from "@/components/shell/AppHeader";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { SessionNotices } from "@/components/notice/SessionNotices";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/feedback";
import "./globals.css";

export const runtime = "nodejs";

// viewportFit: "cover" is what makes env(safe-area-inset-*) resolve to real
// numbers on a notched iPhone; without it those insets are always 0 and the
// padding in globals.css silently does nothing. The rest matches what Next
// emits by default, spelled out so it cannot drift.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Colours the browser chrome to match the header instead of leaving a
  // mismatched bar above the app on mobile.
  themeColor: "#ffffff"
};

export const metadata: Metadata = {
  title: "Dental Note Builder",
  description:
    "Standardized, de-identified dental note drafts with a deterministic audit pass. No patient identifiers ever enter this tool."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fresh role/active on every page render — the token alone is never
  // trusted (a deactivated or demoted account changes on the next request,
  // not when the 30-day token expires).
  const session = await auth();
  const user = await freshSessionUser();

  // A live cookie whose account is gone, inactive, or password-revoked gets
  // a dead end, not the app shell. The way OUT must clear the cookie — a bare
  // link to /login re-renders this same screen (the layout wraps /login too),
  // which would permanently lock a shared workstation until the 30-day token
  // expired. SignOutButton clears the session and lands on /login for real.
  if (session?.user && !user) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
          <main className="mx-auto max-w-md px-4 py-16 text-center">
            <h1 className="mb-2 text-xl font-bold">This session is no longer valid</h1>
            <p className="mb-6 text-sm text-slate-600">
              The account was deactivated or removed, or its password changed. Sign out to reach
              the sign-in page. Ask an administrator if this is a surprise.
            </p>
            <div className="flex justify-center">
              <SignOutButton />
            </div>
          </main>
        </body>
      </html>
    );
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
        <AppHeader user={user} />
        {user && <SessionNotices acknowledged={user.noticeAcked} />}
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
          {/* The reminder is dismissible, so the route to the developer has to
              survive it being dismissed. */}
          <p className="mt-3">
            Support, upgrade requests, ideas and suggestions, or a bug to report?{" "}
            <a
              href={feedbackMailto()}
              className="tap rounded font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Send feedback
            </a>{" "}
            <span className="text-slate-400">({FEEDBACK_EMAIL})</span>
          </p>
        </footer>
      </body>
    </html>
  );
}
