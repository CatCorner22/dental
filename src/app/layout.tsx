import type { Metadata, Viewport } from "next";
import { auth } from "@/lib/auth/auth";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { AppHeader } from "@/components/shell/AppHeader";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { SessionNotices } from "@/components/notice/SessionNotices";
import { BrandFooter } from "@/components/shell/BrandFooter";
import { APP_DESCRIPTION, APP_NAME, COPYRIGHT } from "@/lib/brand";
import { prefsBootScript } from "@/lib/client/displayPrefs";
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
  // `template` gives every child route the "<page> — Smile Notes" suffix
  // automatically, so a new page cannot ship with a bare, unbranded title.
  title: { default: APP_NAME, template: `%s — ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "Blake Reagan" }],
  // Surfaces the ownership claim to anything that reads the document head —
  // a saved page, a scraper, a print-to-PDF.
  other: { copyright: COPYRIGHT }
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
        <body className="min-h-screen bg-brand-cream text-slate-900 antialiased">
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
      <head>
        {/* BEFORE FIRST PAINT, deliberately. Applied from an effect instead, the
            page renders at the default size and then jumps — and for the person who
            chose a larger size because they cannot read the default, that first
            paint is the one that most needs to already be right. next.config.mjs
            documents why 'unsafe-inline' is granted for script-src; this is the
            kind of thing that exemption is for. */}
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript() }} />
      </head>
      <body className="min-h-screen bg-brand-cream text-slate-900 antialiased">
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
        <BrandFooter />
      </body>
    </html>
  );
}
