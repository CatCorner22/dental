"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="tap rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}
