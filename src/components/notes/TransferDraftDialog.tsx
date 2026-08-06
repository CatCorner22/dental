"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Ownership handoff — shared by DraftList and the note builder.
 *
 * Filing dentist-owned content must land under a dentist's name (approval.ts).
 * The transfer rail already exists; burying it only on /notes made chairside
 * handoff invisible during go-live testing.
 */
export function TransferDraftDialog({
  draftId,
  draftTitle,
  onClose,
  onDone
}: {
  draftId: string;
  draftTitle: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [users, setUsers] = useState<
    { id: string; username: string; displayName: string; role: string; active: boolean }[]
  >([]);
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) =>
        setUsers(
          (d.users ?? []).filter(
            (u: { active: boolean; role: string }) => u.active && u.role !== "readonly"
          )
        )
      )
      .catch(() => setError("Could not load users."));
  }, []);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/drafts/${draftId}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toUserId })
      });
      if (res.ok) {
        onDone();
        return;
      }
      setError(
        ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Transfer failed."
      );
    } catch {
      setError("Transfer failed — check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Transfer "${draftTitle}"`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          The note moves to the person you pick. They review the content and file under their own
          name. Nothing you wrote is lost.
        </p>
        <label className="field-label" htmlFor="transfer-to">
          Transfer to
        </label>
        <select
          id="transfer-to"
          className="field-input"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
        >
          <option value="">— select a user —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.username})
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!toUserId || busy}
            onClick={() => void submit()}
          >
            Transfer
          </button>
        </div>
      </div>
    </Dialog>
  );
}
