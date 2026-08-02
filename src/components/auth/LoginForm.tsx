"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    let res;
    try {
      res = await signIn("credentials", { username, password, redirect: false });
    } catch {
      setError("Could not reach the server — check the connection and try again.");
      setBusy(false);
      return;
    }
    if (res?.error) {
      setError("Wrong username or password, or the account is inactive.");
      setBusy(false);
      return;
    }
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
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
