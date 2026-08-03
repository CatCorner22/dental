import Link from "next/link";
import {
  canManageUsers,
  canReadAuditLog,
  canSubmitChangeRequest,
  ROLE_LABEL
} from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/roles";
import { SignOutButton } from "./SignOutButton";
import { NavLinks } from "./NavLinks";
import { BrandMark } from "./BrandMark";

// Server component. The banner is always visible; nav adapts to role.
export function AppHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      {/* Wraps to a second line on a phone instead of forcing the page wider
          than the screen. An unwrapped nav here expanded the layout viewport
          to 554px on a 375px device, which pushed every page sideways and
          left dialogs partly off-screen — verified in a real browser. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="tap rounded">
          <BrandMark />
        </Link>
        <nav className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {user ? (
            <>
              <NavLinks
                items={[
                  { href: "/", label: "Dashboard" },
                  { href: "/history", label: "History" },
                  { href: "/reference/templates", label: "References", activePrefix: "/reference" },
                  ...(canSubmitChangeRequest(user.role)
                    ? [{ href: "/requests", label: "Requests" }]
                    : []),
                  ...(canManageUsers(user.role) ? [{ href: "/admin/users", label: "Users" }] : []),
                  ...(canReadAuditLog(user.role) ? [{ href: "/admin/audit", label: "Audit log" }] : []),
                  { href: "/account", label: "Account" }
                ]}
              />
              <span className="hidden text-slate-400 sm:inline">·</span>
              {/* The human label, not the enum value. "lead" told nobody what
                  they could do; "Team Lead" is the word the hierarchy is
                  actually documented in. */}
              <span className="hidden text-xs text-slate-500 sm:inline">
                {user.displayName} ({ROLE_LABEL[user.role]})
              </span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="font-medium text-blue-700 hover:text-blue-900">Sign in</Link>
          )}
        </nav>
      </div>
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
        This system may form part of a legal and medical record. Enter de-identified facts only —
        never a patient name, exact date, contact detail, record number, or image.
      </div>
    </header>
  );
}
