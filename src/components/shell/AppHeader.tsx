import Link from "next/link";
import {
  canManageUsers,
  canReadAuditLog,
  canSubmitChangeRequest,
  meetsRole,
  ROLE_LABEL
} from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/roles";
import { NavLinks } from "./NavLinks";
import { NavMenu } from "./NavMenu";
import { BrandMark } from "./BrandMark";

// Server component. The banner is always visible; nav adapts to role.
export function AppHeader({ user }: { user: SessionUser | null }) {
  return (
    /* A navy hairline under the header, and the nav in navy rather than slate.
       The audit that prompted this found brand-navy used ZERO times in the app —
       the identity lived entirely in the logomark, so the shell read as a generic
       admin template. This is chrome only; no state colour is involved. */
    /* Sticky glass on desktop: the header stays reachable however deep a
       long note scrolls, translucent white over the ground wash with a blur
       so content sliding beneath reads as depth. NOT sticky on phones — the
       nav wraps to several rows there, and a header that eats a third of a
       small screen costs more than the shortcut is worth. */
    <header className="border-b-2 border-brand-navy/15 bg-white/90 backdrop-blur-sm md:sticky md:top-0 md:z-40">
      {/* Wraps to a second line on a phone instead of forcing the page wider
          than the screen. An unwrapped nav here expanded the layout viewport
          to 554px on a 375px device, which pushed every page sideways and
          left dialogs partly off-screen — verified in a real browser. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="tap rounded">
          <BrandMark />
        </Link>
        {/* gap-x-1.5, not 3: the pills carry their own horizontal padding now,
            so the old text-link gap on top of it pushed the identity block
            onto a second row at laptop widths. */}
        <nav className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm">
          {user ? (
            <>
              {/* FOUR pills, not twelve.
                  Twelve equally-weighted destinations is not navigation, it is
                  a list: the eye has to read all of them to find one, on every
                  page, forever — and on a phone the row wrapped to three lines
                  before the content started. These four are what a clinician
                  touches while working. Everything else is administration and
                  settings, which are visited deliberately and can afford the
                  one extra click of the More menu. Nothing was dropped. */}
              <NavLinks
                items={[
                  // Owns "/" and the note routes, so opening a specific draft
                  // does not un-highlight the place you are working.
                  { href: "/", label: "Notes", alsoOwns: ["/note/"] },
                  { href: "/notes", label: "My notes" },
                  { href: "/reference/templates", label: "Learn", activePrefix: "/reference" },
                  { href: "/wishes", label: "Ask" }
                ]}
              />
              <NavMenu
                identity={`${user.displayName} (${ROLE_LABEL[user.role]})`}
                items={[
                  ...(meetsRole(user.role, "user")
                    ? [
                        {
                          href: "/notes/batch",
                          label: "Batch check",
                          hint: "End-of-day triage"
                        }
                      ]
                    : []),
                  { href: "/account", label: "Account" },
                  // Team Lead and above. Named "Digest" rather than "Quality"
                  // or "Review": those words describe judging people, and this
                  // page reports patterns and explicitly re-scopes anything
                  // most of the practice would be flagged for onto the tool.
                  ...(meetsRole(user.role, "lead")
                    ? [
                        { href: "/digest", label: "Digest", hint: "Documentation patterns" },
                        { href: "/admin/bytestar", label: "SuperByte", hint: "Deployment and ladder" }
                      ]
                    : []),
                  ...(canManageUsers(user.role)
                    ? [{ href: "/admin/team", label: "Team", activePrefix: "/admin/team" }]
                    : []),
                  ...(canSubmitChangeRequest(user.role)
                    ? [{ href: "/requests", label: "Requests", hint: "Data Hygiene Gauntlet" }]
                    : []),
                  ...(canManageUsers(user.role) ? [{ href: "/admin/users", label: "Users" }] : []),
                  ...(canReadAuditLog(user.role) ? [{ href: "/admin/audit", label: "Audit log" }] : [])
                  // Store stays at /store for anyone who bookmarks it, but it is
                  // in neither the pills nor this menu — a points shop next to
                  // "start a note" invites comparison and hallway scorekeeping.
                  // (Same reasoning the digest itself follows: patterns, never a
                  // scoreboard.)
                ]}
              />
            </>
          ) : (
            <Link href="/login" className="font-medium text-brand-blue hover:text-brand-navy">Sign in</Link>
          )}
        </nav>
      </div>
      {/* Navy, not amber. This is a STANDING CONDITION OF USE, not a warning
          about the current screen — and amber is the audit vocabulary's REVIEW
          colour. A permanent amber bar spends that signal on something that is
          always true, which teaches the eye to skip amber in the one place it
          means "look at this now". Same words, same prominence, a colour that
          does not collide. */}
      <div className="border-t border-brand-navy/15 bg-brand-navy/[0.04] px-4 py-1.5 text-center text-xs font-medium text-brand-navy">
        This system may form part of a legal and medical record. Enter de-identified facts only —
        never a patient name, exact date, contact detail, record number, or image.
      </div>
    </header>
  );
}
