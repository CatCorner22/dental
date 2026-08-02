"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function SetupForm() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Every await is guarded: an unhandled rejection here would leave the
    // button stuck on "Creating…" forever with no message and no way forward.
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName, password })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Setup failed.");
        setBusy(false);
        return;
      }
    } catch {
      setError("Could not reach the server — check the connection and try again.");
      setBusy(false);
      return;
    }
    // The admin now EXISTS; if the auto sign-in fails for any reason, land on
    // the sign-in page (where the new credentials work) rather than sticking.
    try {
      const login = await signIn("credentials", { username, password, redirect: false });
      window.location.assign(login?.error ? "/login" : "/");
    } catch {
      window.location.assign("/login");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="field-label" htmlFor="su-user">Username</label>
        <input id="su-user" className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <label className="field-label" htmlFor="su-name">Display name</label>
        <input id="su-name" className="field-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown on submissions" />
      </div>
      <div>
        <label className="field-label" htmlFor="su-pass">Password (10+ characters)</label>
        <input id="su-pass" type="password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Creating…" : "Create admin & sign in"}
      </button>
    </form>
  );
}
