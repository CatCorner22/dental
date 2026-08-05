"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { PASSWORD_HINT, PASSWORD_MIN, passwordPolicyError } from "@/lib/auth/password";
import { generatePassword } from "@/lib/auth/genPassword";
import { usernamePolicyError } from "@/lib/auth/username";

export function SetupForm() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdPendingLogin, setCreatedPendingLogin] = useState(false);

  const clientError = (): string | null => {
    const uErr = usernamePolicyError(username);
    if (uErr) return uErr;
    const pErr = passwordPolicyError(password);
    if (pErr) return pErr;
    if (password !== confirm) return "The two passwords do not match.";
    return null;
  };

  const gen = () => {
    const next = generatePassword();
    setPassword(next);
    setConfirm(next);
    setShowPassword(true);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = clientError();
    if (bad) {
      setError(bad);
      return;
    }
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
    // The admin now EXISTS. Auto sign-in should land on home; if it fails,
    // stay here with a clear next step — silent /login redirects felt like
    // "the password never worked."
    setCreatedPendingLogin(true);
    try {
      const login = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false
      });
      if (!login?.error) {
        window.location.assign("/");
        return;
      }
      setError(
        "Your Developer account was created, but automatic sign-in did not finish. " +
          "Use Sign in with the username and password you just chose (shown below if you generated one)."
      );
      setShowPassword(true);
      setBusy(false);
    } catch {
      setError(
        "Your Developer account was created, but automatic sign-in could not reach the server. " +
          "Open Sign in and use the username and password you just chose."
      );
      setShowPassword(true);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="field-label" htmlFor="su-user">
          Username
        </label>
        <input
          id="su-user"
          className="field-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          disabled={createdPendingLogin}
        />
        <p className="mt-1 text-xs text-slate-500">
          3–40 characters. Mix letters, digits, periods, underscores, and hyphens freely. No spaces.
        </p>
      </div>
      <div>
        <label className="field-label" htmlFor="su-name">
          Display name
        </label>
        <input
          id="su-name"
          className="field-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Shown on submissions"
          disabled={createdPendingLogin}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="su-pass">
          Password
        </label>
        <div className="flex gap-1.5">
          <input
            id="su-pass"
            type={showPassword ? "text" : "password"}
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            disabled={createdPendingLogin}
          />
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={gen}
            disabled={createdPendingLogin}
            title="Generate a strong password"
          >
            Generate
          </button>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => setShowPassword((v) => !v)}
            disabled={!password}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{PASSWORD_HINT}</p>
      </div>
      <div>
        <label className="field-label" htmlFor="su-confirm">
          Confirm password
        </label>
        <input
          id="su-confirm"
          type={showPassword ? "text" : "password"}
          className="field-input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          disabled={createdPendingLogin}
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {createdPendingLogin ? (
        <a href="/login" className="btn-primary flex w-full justify-center">
          Go to sign in
        </a>
      ) : (
        <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? "Creating…" : "Create admin & sign in"}
        </button>
      )}
    </form>
  );
}
