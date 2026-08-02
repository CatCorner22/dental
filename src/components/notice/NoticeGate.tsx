"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

// Shown once per user until acknowledged. The permanent banner stays in the
// header regardless; this is the explicit up-front acknowledgment.
export function NoticeGate({ acknowledged }: { acknowledged: boolean }) {
  const [done, setDone] = useState(acknowledged);
  const [busy, setBusy] = useState(false);
  if (done) return null;

  const ack = async () => {
    setBusy(true);
    await fetch("/api/ack-notice", { method: "POST" }).catch(() => {});
    setDone(true);
  };

  return (
    <Dialog title="Before you begin" onClose={() => {}}>
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
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" disabled={busy} onClick={ack}>
          {busy ? "Saving…" : "I understand"}
        </button>
      </div>
    </Dialog>
  );
}
