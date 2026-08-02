import Link from "next/link";
import type { SessionUser } from "@/lib/auth/roles";
import { SignOutButton } from "./SignOutButton";

// Server component. The banner is always visible; nav adapts to role.
export function AppHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          🦷 Dental Note Builder
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/" className="font-medium text-slate-700 hover:text-slate-900">Dashboard</Link>
              <Link href="/history" className="font-medium text-slate-700 hover:text-slate-900">History</Link>
              <Link href="/reference/templates" className="font-medium text-slate-700 hover:text-slate-900">References</Link>
              {user.role === "admin" && (
                <Link href="/admin/users" className="font-medium text-slate-700 hover:text-slate-900">Admin</Link>
              )}
              <span className="hidden text-slate-400 sm:inline">·</span>
              <span className="hidden text-xs text-slate-500 sm:inline" title={`Role: ${user.role}`}>
                {user.displayName} ({user.role})
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
