"use client";

import { useEffect, useState } from "react";
import { PASSWORD_HINT, PASSWORD_MIN } from "@/lib/auth/password";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Disabled until hydration, enabled by the mount effect below. These are
  // still onSubmit-fetch forms, and a submit that lands before React hydrates
  // falls back to NATIVE submission — a GET that reloads the page and silently
  // discards everything typed. With the default button disabled, implicit
  // (Enter-key) submission is a no-op too, so pre-hydration the form simply
  // waits instead of eating input. LoginForm solved this properly with a
  // server action (see src/lib/auth/loginAction.ts) — that is the pattern to
  // follow when these forms are next touched; this is the minimal guard for
  // two rarely-used flows (one-time setup, emailed reset link).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [done, setDone] = useState(false);
  // A LINK THAT IS NEVER GOING TO WORK IS NOT A FORM ERROR.
  //
  // The token is deliberately not checked when this page renders — checking it
  // would make the page an oracle that confirms which links are real before
  // anyone commits to one, and the POST handler is the single place that
  // judges it. That is the right call, and it has a cost that was not being
  // paid: somebody following an expired or already-used link invented a
  // password, typed it twice, pressed the button, and only then got one red
  // line under a form they could now do nothing with. Retrying is pointless —
  // this token will never be valid again — and there is no self-serve way to
  // ask for another, so the same person retyped the same password until they
  // gave up.
  //
  // So a dead link ends the form and says who can send a new one.
  const [dead, setDead] = useState(false);

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
      // The route sends one sentence — "This link is no longer valid." — for
      // every way a token can fail: absent, unknown, expired, already spent,
      // or belonging to a deactivated account. Deliberately one sentence, so
      // the reply distinguishes none of those for whoever is guessing. It is
      // still the one reply that means "stop typing".
      if (/no longer valid/i.test(data.error ?? "")) {
        setDead(true);
        return;
      }
      setError(data.error ?? "Could not set the password.");
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  if (dead) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          This link has already been used, or it is more than an hour old. Your password has not
          been changed.
        </p>
        <p className="text-sm text-slate-600">
          Reset links are sent from User admin, so ask a Team Lead or the Developer for a fresh
          one. There is no self-service reset — that is on purpose, because a link that anyone can
          request is a link anyone can request for your account.
        </p>
        <a className="btn-primary inline-flex" href="/login">
          Back to sign in
        </a>
      </div>
    );
  }

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
      <button
        type="submit"
        className="btn-primary w-full justify-center"
        disabled={busy || !hydrated}
      >
        {busy ? "Setting…" : hydrated ? "Set password" : "Loading…"}
      </button>
    </form>
  );
}
