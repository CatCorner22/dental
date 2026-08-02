"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { AuditFinding } from "@/lib/audit/types";
import type { NoteState } from "@/lib/schema/types";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

export function ConflictDialog({ onReload, onClose }: { onReload: () => void; onClose: () => void }) {
  return (
    <Dialog title="A newer version of this note exists" onClose={onClose}>
      <p className="mb-2 text-sm text-slate-700">
        A teammate (or another tab) saved a newer version after you opened this one. Reloading
        keeps you both in step; the unsaved edits in this tab will be replaced.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        {sparkleLine("conflict", daySeed(new Date()))}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Keep editing here
        </button>
        <button type="button" className="btn-primary" onClick={onReload}>
          Reload latest
        </button>
      </div>
    </Dialog>
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
        Export and submit stay blocked until you attest each is a clinical value, not an identifier.
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
        <span>I reviewed every flagged item. None is a patient identifier, exact date, contact detail, or record number.</span>
      </label>
      <input
        type="text"
        className="field-input mb-3"
        placeholder="Why these are clinical values (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={!checked || reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>
          Override this privacy stop
        </button>
      </div>
    </Dialog>
  );
}

interface SubmitCapability {
  emailConfigured: boolean;
}

export function SubmitDialog({
  draftId,
  phiOverrideReason,
  onClose,
  onSubmitted
}: {
  draftId: string;
  phiOverrideReason: string | null;
  onClose: () => void;
  onSubmitted: (ticket: string, sparkle: string) => void;
}) {
  const [cap, setCap] = useState<SubmitCapability | null>(null);
  const [format, setFormat] = useState<"md" | "txt">("md");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/submit-config")
      .then((r) => r.json())
      .then(setCap)
      .catch(() => setCap({ emailConfigured: false }));
  }, []);

  const submit = async () => {
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format,
          ...(phiOverrideReason ? { phiOverride: { confirmed: true, reason: phiOverrideReason } } : {})
        })
      });
      if (res.ok) {
        const data = (await res.json()) as { ticket: string; sparkle: string };
        onSubmitted(data.ticket, data.sparkle);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Submit failed (${res.status}).`);
      setStatus("error");
    } catch {
      setError("Submit failed — check your connection.");
      setStatus("error");
    }
  };

  return (
    <Dialog title="Submit note to the office" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-700">
        This files the note with a ticket number and emails it (with its audit report) to the
        corporate address. Identifiers are completed later in the EDR.
      </p>
      {cap && !cap.emailConfigured && (
        <p className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Email is not configured on the server, so the note will be filed with a ticket and shown
          in History, but not emailed. Ask your administrator to configure email.
        </p>
      )}
      <div className="mb-3 flex items-center gap-3 text-sm">
        <span className="font-medium">Attachment format:</span>
        {(["md", "txt"] as const).map((f) => (
          <label key={f} className="flex items-center gap-1">
            <input type="radio" checked={format === f} onChange={() => setFormat(f)} />.{f}
          </label>
        ))}
      </div>
      {status === "error" && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={status === "sending"} onClick={submit}>
          {status === "sending" ? "Submitting…" : "Submit note"}
        </button>
      </div>
    </Dialog>
  );
}

export type { NoteState };
