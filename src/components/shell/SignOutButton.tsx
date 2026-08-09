"use client";

import { signOut } from "next-auth/react";
import { clearAllDraftBackups } from "@/lib/client/draftBackup";

/**
 * Shared-tablet honesty: wipe local draft mirrors, then end the session so the
 * next person must sign in as themselves. Not a full per-patient lock — that
 * still needs ops policy — but closes the "walk away with prior author's
 * IndexedDB note" hole the IT hate panel named.
 */
export async function endAuthorSession(): Promise<void> {
  await clearAllDraftBackups();
  await signOut({ callbackUrl: "/login" });
}

export function SignOutButton({
  label = "Sign out",
  className = "tap rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void endAuthorSession();
      }}
      className={className}
    >
      {label}
    </button>
  );
}

/** Prominent shared-device control — same wipe + sign-out, louder label. */
export function SwitchAuthorButton({
  className = "tap rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100"
}: {
  className?: string;
}) {
  return (
    <button
      type="button"
      title="Ends this session and clears local draft backups on this device"
      onClick={() => {
        void endAuthorSession();
      }}
      className={className}
    >
      Switch author
    </button>
  );
}
