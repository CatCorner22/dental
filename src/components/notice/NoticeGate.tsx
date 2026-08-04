"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

// Shown once per user until acknowledged. The permanent banner stays in the
// header regardless; this is the explicit up-front acknowledgment.
export function NoticeGate({
  acknowledged,
  onAcknowledged
}: {
  acknowledged: boolean;
  // Fires on a CONFIRMED save so whatever comes next in the session can
  // start; the server prop will not change until the next full render.
  onAcknowledged?: () => void;
}) {
  const [done, setDone] = useState(acknowledged);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // An account that acknowledged on a previous visit still needs the handoff.
  useEffect(() => {
    if (acknowledged) onAcknowledged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acknowledged]);
  if (done) return null;

  // The server refuses every other API until this acknowledgment is stored,
  // so the gate must only close on a CONFIRMED save — closing optimistically
  // would leave the user locked out with no visible reason.
  const ack = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ack-notice", { method: "POST" });
      if (!res.ok) throw new Error();
      setDone(true);
      onAcknowledged?.();
    } catch {
      setError("Could not save your acknowledgment — check the connection and try again.");
      setBusy(false);
    }
  };

  return (
    <Dialog title="Before you begin" onClose={() => {}} dismissible={false}>
      <div className="space-y-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">
          This system may form part of a legal and medical record.
        </p>
        <p>
          What you enter here can support patient care and may be used in legal or regulatory
          review. Accuracy and following the standard process matter.
        </p>
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
          Never enter protected health information: no patient names, exact dates, contact details,
          record numbers, or images. Use placeholders and complete identifiers only in the EDR.
        </p>
        <p>
          Notes are de-identified drafts. A licensed clinician reviews every note, resolves each
          audit finding, and signs in the EDR.
        </p>
      </div>
      {/* The failure this dialog cannot afford to swallow. The gate is not
          dismissible and the server refuses every other API until the
          acknowledgment is stored, so a user whose POST fails is sealed inside
          a modal with a button that appears to do nothing. The message was
          already being set — it was simply never rendered. */}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900"
        >
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" disabled={busy} onClick={ack}>
          {busy ? "Saving…" : error ? "Try again" : "I understand"}
        </button>
      </div>
    </Dialog>
  );
}
