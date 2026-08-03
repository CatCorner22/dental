"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { AuditFinding } from "@/lib/audit/types";
import { isValidPhiAttestation, PHI_ATTESTATION_RULE } from "@/lib/audit/engine";
import type { NoteState } from "@/lib/schema/types";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import { Character } from "@/components/mascot/Sparkle";

export function ConflictDialog({ onReload, onClose }: { onReload: () => void; onClose: () => void }) {
  // NOT dismissible: "Keep editing here" is a last-writer-wins overwrite of a
  // teammate's saved version. That choice must be an explicit button press —
  // never the reflexive ESC / backdrop-click / ✕ a user makes to dismiss.
  return (
    <Dialog title="A newer version of this note exists" onClose={onClose} dismissible={false}>
      <p className="mb-2 text-sm text-slate-700">
        A teammate (or another tab) saved a newer version after you opened this one. Reloading
        keeps you both in sync; the unsaved edits in this tab will be replaced.
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
  maskableCount,
  onMask,
  onConfirm,
  onClose
}: {
  phiStops: AuditFinding[];
  maskableCount: number;
  onMask: () => void;
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
      {/* Masking is offered FIRST and as the primary action. Before it existed
          the only ways forward were retype by hand or waive the stop, and
          between patients the waiver wins — a bad default for the one gate the
          PII-free premise rests on. */}
      {maskableCount > 0 && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3">
          <p className="mb-2 text-sm text-green-900">
            <strong>If any of these IS an identifier, redact it instead.</strong> Each one is
            replaced in place with a random token like <code>[PERSON-A7K2]</code>. The token is not
            derived from the text, so nothing can be recovered from it, and repeats of the same
            identifier become the same token so the note still reads.
          </p>
          <button type="button" className="btn-primary" onClick={onMask}>
            Mask {maskableCount} flagged item{maskableCount === 1 ? "" : "s"}
          </button>
        </div>
      )}
      <p className="mb-2 text-sm font-medium text-slate-700">Or attest that none of them is an identifier:</p>
      <label className="mb-2 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
        <span>I reviewed every flagged item. None is a patient identifier, exact date, contact detail, or record number.</span>
      </label>
      <input
        type="text"
        className="field-input mb-1"
        placeholder="What the flagged text actually is (required)"
        aria-label="What the flagged text actually is (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {/* The server enforces the same validator; this mirror exists so nobody
          types a reason the submit will refuse. The old five-character floor
          was browser-only, which made the whole gate client-side theater. */}
      <p className="mb-3 text-xs text-slate-500">{PHI_ATTESTATION_RULE} Your name and this reason become part of the filed record.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={!checked || !isValidPhiAttestation(reason)} onClick={() => onConfirm(reason.trim())}>
          Override this privacy stop
        </button>
      </div>
    </Dialog>
  );
}

interface SubmitCapability {
  emailConfigured: boolean;
}

export interface FiledResult {
  ticket: string;
  sparkle: string;
  emailed: boolean;
  emailConfigured: boolean;
  // The server bumps the draft version when it claims the submit; the builder
  // adopts this so its next autosave is not a false 409.
  version?: number;
}

export function SubmitDialog({
  draftId,
  phiOverrideReason,
  onClose,
  onFiled,
  onStartAnother,
  onGoToDashboard
}: {
  draftId: string;
  phiOverrideReason: string | null;
  onClose: () => void;
  // Fires the moment the filing succeeds (even if the user stays), so the
  // builder can flip its status chip to Submitted right away.
  onFiled: (result: FiledResult) => void;
  onStartAnother: () => void;
  onGoToDashboard: () => void;
}) {
  const [cap, setCap] = useState<SubmitCapability | null>(null);
  const [format, setFormat] = useState<"md" | "txt">("md");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const [filed, setFiled] = useState<FiledResult | null>(null);
  const [busyNext, setBusyNext] = useState(false);
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  // Resend re-sends the frozen copy that is already on file. It mints no
  // ticket and writes no submission row, so it is safe to press repeatedly
  // during an outage — which is exactly when someone will.
  const doResend = async () => {
    setResend("sending");
    try {
      const res = await fetch(`/api/drafts/${draftId}/resend`, { method: "POST" });
      setResend(res.ok ? "sent" : "failed");
      if (res.ok) setFiled((f) => (f ? { ...f, emailed: true } : f));
    } catch {
      setResend("failed");
    }
  };

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
        const data = (await res.json()) as {
          ticket: string;
          sparkle: string;
          emailed: boolean;
          version?: number;
        };
        const result: FiledResult = {
          ticket: data.ticket,
          sparkle: data.sparkle,
          emailed: data.emailed,
          emailConfigured: cap?.emailConfigured ?? false,
          version: data.version
        };
        setFiled(result);
        onFiled(result);
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

  if (filed) {
    const sendFailed = !filed.emailed && filed.emailConfigured;
    return (
      <Dialog title={`Filed as ${filed.ticket}`} onClose={onClose}>
        <p className="mb-2 text-sm text-slate-700">
          {filed.emailed
            ? "The note and its audit report were emailed to the office."
            : filed.emailConfigured
              ? "The note was filed, but the email did not send. The ticket is safe — use Resend to try the same filed copy again."
              : "The note was filed and appears in History. Email is not configured, so nothing was sent."}
        </p>
        {sendFailed && (
          <div className="mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900" role="alert">
            <p className="mb-2">
              Send failed — the office did not receive this note yet. Resending sends the exact
              filed copy; it never files a second ticket.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={resend === "sending"}
                onClick={doResend}
              >
                {resend === "sending" ? "Resending…" : resend === "sent" ? "Sent ✓" : "Resend email"}
              </button>
              {resend === "failed" && <span>Still failing. Try again shortly.</span>}
            </div>
          </div>
        )}
        {/* The mascot appears at the one moment worth celebrating: a note
            filed clean. Decorative — the line beside her carries the meaning. */}
        <div className="mb-4 flex items-center gap-2">
          <Character id="sparkle" size="sm" />
          <p className="text-xs text-slate-500">{filed.sparkle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Stay here
          </button>
          <button type="button" className="btn-secondary" onClick={onGoToDashboard}>
            Dashboard
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busyNext}
            title="Start a new Smile Note with the same modules — no values are copied"
            onClick={() => {
              setBusyNext(true);
              onStartAnother();
            }}
          >
            {busyNext ? "Starting…" : "Start another like this"}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Submit Smile Note to the office" onClose={onClose}>
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
        <button
          type="button"
          className="btn-primary"
          // Wait for the email-config check so the filed panel reports "sent"
          // vs "not sent" from real server state, never a pre-load guess.
          disabled={status === "sending" || cap === null}
          onClick={submit}
        >
          {status === "sending" ? "Submitting…" : cap === null ? "Checking…" : "Submit note"}
        </button>
      </div>
    </Dialog>
  );
}

export type { NoteState };
