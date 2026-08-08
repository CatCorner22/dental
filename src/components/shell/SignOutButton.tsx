"use client";

import { signOut } from "next-auth/react";
import { clearAllDraftBackups } from "@/lib/client/draftBackup";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Shared-tablet honesty: wipe local draft mirrors before the session
        // cookie dies so the next author cannot recover the prior note offline.
        void clearAllDraftBackups().finally(() => {
          void signOut({ callbackUrl: "/login" });
        });
      }}
      className="tap rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}
