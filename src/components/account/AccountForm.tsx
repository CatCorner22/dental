"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { PASSWORD_HINT, PASSWORD_MIN } from "@/lib/auth/password";

export function AccountForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: "The new passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next })
      });
      if (res.ok) {
        // The change revoked every session minted with the old password —
        // including this one. Say so, then route through a real sign-out so
        // the user lands on the sign-in page instead of a dead-session screen.
        setMsg({ ok: true, text: "Password changed. Signing you out so you can sign back in…" });
        setCurrent("");
        setNext("");
        setConfirm("");
        setTimeout(() => void signOut({ callbackUrl: "/login" }), 1500);
      } else {
        setMsg({ ok: false, text: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Change failed." });
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server — check the connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="field-label" htmlFor="ac-cur">Current password</label>
        <input id="ac-cur" type="password" className="field-input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      <div>
        <label className="field-label" htmlFor="ac-new">New password</label>
        <input
          id="ac-new"
          type="password"
          className="field-input"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
        />
        <p className="mt-1 text-xs text-slate-500">{PASSWORD_HINT}</p>
      </div>
      <div>
        <label className="field-label" htmlFor="ac-conf">Confirm new password</label>
        <input id="ac-conf" type="password" className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} role="alert">{msg.text}</p>}
      <button type="submit" className="btn-primary" disabled={busy || next.length < PASSWORD_MIN}>
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
