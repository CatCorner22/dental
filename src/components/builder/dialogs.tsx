"use client";

import { useEffect, useState } from "react";
import type { AuditFinding } from "@/lib/audit/types";
import type { NoteState } from "@/lib/schema/types";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PhiOverrideDialog({
  phiStops,
  onConfirm,
  onClose
}: {
  phiStops: AuditFinding[];
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog title="Privacy stop — review required" onClose={onClose}>
      <p className="mb-2 text-sm text-slate-700">
        The checker flagged {phiStops.length} possible identifier{phiStops.length === 1 ? "" : "s"}.
        Export stays blocked until you attest that every flagged item is a clinical value, not an
        identifier.
      </p>
      <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
        {phiStops.map((f, i) => (
          <li key={i}>
            <span className="font-mono">{f.matchedText}</span> — {f.message}
          </li>
        ))}
      </ul>
      <label className="mb-2 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
        <span>
          I reviewed every flagged item. None is a patient identifier, exact date, contact detail,
          or record number.
        </span>
      </label>
      <input
        type="text"
        className="field-input mb-3"
        placeholder="Why these are clinical values (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!checked || reason.trim().length < 5}
          onClick={() => onConfirm(reason.trim())}
        >
          Override this privacy stop
        </button>
      </div>
    </Dialog>
  );
}

interface EmailCapability {
  emailConfigured: boolean;
  accessCodeRequired: boolean;
}

export function EmailDialog({
  filename,
  note,
  phiOverrideReason,
  onClose
}: {
  filename: string;
  note: NoteState;
  phiOverrideReason: string | null;
  onClose: () => void;
}) {
  const [capability, setCapability] = useState<EmailCapability | null>(null);
  const [format, setFormat] = useState<"md" | "txt">("md");
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/send-note")
      .then((r) => r.json())
      .then(setCapability)
      .catch(() => setCapability({ emailConfigured: false, accessCodeRequired: false }));
  }, []);

  const send = async () => {
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/send-note", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(capability?.accessCodeRequired ? { "x-access-code": accessCode } : {})
        },
        body: JSON.stringify({
          filename,
          format,
          note,
          ...(phiOverrideReason ? { phiOverride: { confirmed: true, reason: phiOverrideReason } } : {})
        })
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `The send failed (${res.status}).`);
      setStatus("error");
    } catch {
      setError("The send failed. Check the connection and try again, or download instead.");
      setStatus("error");
    }
  };

  return (
    <Dialog title="Email the note to the corporate address" onClose={onClose}>
      {capability === null && <p className="text-sm text-slate-500">Checking the email setup…</p>}
      {capability && !capability.emailConfigured && (
        <p className="text-sm text-slate-700">
          Email is not configured for this deployment. Ask the administrator to set
          RESEND_API_KEY, EMAIL_FROM, and CORPORATE_EMAIL, or use Download instead.
        </p>
      )}
      {capability?.emailConfigured && status !== "sent" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            The note goes only to the corporate address set on the server, as an attachment. No
            other recipient is possible.
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">Attachment format:</span>
            {(["md", "txt"] as const).map((f) => (
              <label key={f} className="flex items-center gap-1">
                <input type="radio" checked={format === f} onChange={() => setFormat(f)} />.{f}
              </label>
            ))}
          </div>
          {capability.accessCodeRequired && (
            <div>
              <label className="field-label">Office access code</label>
              <input
                type="password"
                className="field-input"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />
            </div>
          )}
          {status === "error" && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={status === "sending"} onClick={send}>
              {status === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
      {status === "sent" && (
        <div>
          <p className="mb-3 text-sm font-medium text-green-800">
            Sent. Merge the draft into the correct chart and complete the EDR-only fields there.
          </p>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
