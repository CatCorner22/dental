"use client";

import { useState } from "react";
import { PASSWORD_HINT, PASSWORD_MIN } from "@/lib/auth/password";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not set the password.");
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Your password is set. Any other device that was signed in to this account has been
          signed out.
        </p>
        <a className="btn-primary inline-flex" href="/login">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-slate-600">
        {PASSWORD_HINT} Nobody at the practice can see it.
      </p>
      <div>
        <label className="field-label" htmlFor="rs-pass">
          New password
        </label>
        <input
          id="rs-pass"
          type="password"
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="rs-confirm">
          Confirm new password
        </label>
        <input
          id="rs-confirm"
          type="password"
          className="field-input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Setting…" : "Set password"}
      </button>
    </form>
  );
}
