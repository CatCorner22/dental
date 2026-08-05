"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { markFeedbackNoticeUnseen } from "@/components/notice/FeedbackNotice";

// mfaAvailable comes from the server (deployment-level switch). When false,
// the authenticator-code field never appears — a code box offered on a
// deployment that will never check a code reads as "you are locked out of
// something you never set up".
export function LoginForm({ mfaAvailable = true }: { mfaAvailable?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showTotp, setShowTotp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    let res;
    try {
      res = await signIn("credentials", { username, password, totp, redirect: false });
    } catch {
      setError("Could not reach the server — check the connection and try again.");
      setBusy(false);
      return;
    }
    if (res?.error) {
      // A failure with correct-looking credentials may be a missing second
      // factor. The server never says which (an attacker must not learn
      // whether an account has MFA from the error), so the form OFFERS the
      // code field after any failure instead of asserting it is needed —
      // but only on deployments where a code could ever be the answer.
      if (mfaAvailable) setShowTotp(true);
      setError(
        !mfaAvailable
          ? "Sign-in failed. Check the username and password."
          : showTotp || totp
            ? "Sign-in failed. Check the username, password, and authenticator code."
            : "Sign-in failed. If this account uses an authenticator app, enter the current code below."
      );
      setBusy(false);
      return;
    }
    // A real sign-in re-arms the feedback reminder, so every login shows it
    // once — moving around the app afterwards does not.
    markFeedbackNoticeUnseen();
    // Full navigation reliably picks up the new session cookie. Honor the
    // page the middleware bounced the user from — same-origin paths only,
    // so a crafted link can never redirect the login off-site.
    let dest = "/";
    const cb = new URLSearchParams(window.location.search).get("callbackUrl");
    if (cb) {
      try {
        const u = new URL(cb, window.location.origin);
        if (u.origin === window.location.origin) dest = u.pathname + u.search;
      } catch {
        /* keep "/" */
      }
    }
    window.location.assign(dest);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="field-label" htmlFor="li-user">Username</label>
        <input id="li-user" className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <label className="field-label" htmlFor="li-pass">Password</label>
        <input id="li-pass" type="password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {showTotp && (
        <div>
          <label className="field-label" htmlFor="li-totp">Authenticator code</label>
          <input
            id="li-totp"
            className="field-input"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={7}
          />
        </div>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
