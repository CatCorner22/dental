"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

// "Sign out everywhere" for a shared-workstation practice. The realistic way a
// dental office loses control of an identity is not a stolen password — it is a
// clinician who signed in at the operatory machine and walked away. This ends
// every session for the account without needing to change the password.
export function RevokeSessions() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const revoke = async () => {
    if (
      !window.confirm(
        "Sign out of Smile Notes on every device, including this one? You will need to sign in again."
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/sessions", { method: "DELETE" });
      if (res.ok) {
        // This session is now revoked too. Route through a real sign-out so the
        // cookie is cleared and the user lands on /login, not a dead-session
        // dead-end.
        void signOut({ callbackUrl: "/login" });
        return;
      }
      setError(
        ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not sign out."
      );
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">
        Left yourself signed in on an operatory or a home computer? This ends every Smile Notes
        session for your account at once. Use it if you think someone else may be signed in as you.
      </p>
      {error && (
        <p className="mb-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn-secondary" disabled={busy} onClick={revoke}>
        {busy ? "Signing out…" : "Sign out on all devices"}
      </button>
    </div>
  );
}
