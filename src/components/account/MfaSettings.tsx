"use client";

import { useState } from "react";

// TOTP enrollment, three explicit steps mirroring the API: start (secret
// shown once), confirm (prove the app has it), disable (prove you still hold
// the factor you are removing). No QR dependency — every authenticator app
// accepts manual key entry, and the otpauth URI is a tappable link on the
// phone this will usually be read from.

export function MfaSettings({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (body: Record<string, string>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/me/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        secret?: string;
        uri?: string;
        enabled?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
      } else if (data.secret && data.uri) {
        setPending({ secret: data.secret, uri: data.uri });
        setCode("");
      } else if (data.enabled === true) {
        setEnabled(true);
        setPending(null);
        setCode("");
        setNotice("Two-factor authentication is on. You will need a current code at every sign-in.");
      } else if (data.enabled === false) {
        setEnabled(false);
        setPending(null);
        setCode("");
        setNotice("Two-factor authentication is off.");
      }
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="max-w-xl rounded border border-slate-200 bg-white p-4 text-sm">
      <p className="mb-2">
        <span className="font-semibold">Authenticator app (TOTP):</span>{" "}
        {enabled ? (
          <span className="text-green-800">on — a current code is required at sign-in.</span>
        ) : (
          <span className="text-slate-600">off.</span>
        )}
      </p>

      {notice && (
        <p className="mb-2 rounded border border-green-300 bg-green-50 px-2 py-1 text-green-900" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-red-900" role="alert">
          {error}
        </p>
      )}

      {!enabled && !pending && (
        <button className="btn-primary" onClick={() => call({ action: "start" })} disabled={busy}>
          Set up two-factor authentication
        </button>
      )}

      {pending && (
        <div className="space-y-2">
          <p>
            Add this key to your authenticator app (Google Authenticator, Authy, 1Password — any
            TOTP app), then confirm with the current code. Nothing is on until you confirm.
          </p>
          <p className="rounded bg-slate-50 p-2 font-mono text-xs break-all">{pending.secret}</p>
          <p>
            <a className="text-blue-700 underline" href={pending.uri}>
              Open directly in an authenticator app on this device
            </a>
          </p>
          <div className="flex items-end gap-2">
            <div>
              <label className="field-label" htmlFor="mfa-code">Current code</label>
              <input
                id="mfa-code"
                className="field-input w-32"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={7}
              />
            </div>
            <button className="btn-primary" onClick={() => call({ action: "confirm", code })} disabled={busy || !code.trim()}>
              Confirm and turn on
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex items-end gap-2">
          <div>
            <label className="field-label" htmlFor="mfa-off-code">Current code</label>
            <input
              id="mfa-off-code"
              className="field-input w-32"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={7}
            />
          </div>
          <button className="btn-secondary" onClick={() => call({ action: "disable", code })} disabled={busy || !code.trim()}>
            Turn off
          </button>
        </div>
      )}
      {enabled && (
        <p className="mt-2 text-xs text-slate-500">
          Turning it off needs a current code — a walked-away screen cannot strip your second
          factor. Lost the device? A Smile Notes Developer can reset MFA for your account.
        </p>
      )}
    </div>
  );
}
