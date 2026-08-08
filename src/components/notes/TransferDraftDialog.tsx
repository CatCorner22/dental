"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import {
  CLINICAL_ROLE_LABEL,
  type ClinicalRole
} from "@/lib/auth/clinicalRoles";

type TransferUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  clinicalRole?: ClinicalRole;
  active: boolean;
};

function clinicalRank(role: ClinicalRole | undefined): number {
  // Dentist first — the usual destination for "Transfer to dentist".
  if (role === "dentist") return 0;
  if (role === "hygienist") return 1;
  if (role === "assistant") return 2;
  return 3;
}

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
  const [users, setUsers] = useState<TransferUser[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [toUserId, setToUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ users?: TransferUser[] }>;
      })
      .then((d) => {
        if (cancelled) return;
        setUsers(
          (d.users ?? []).filter((u) => u.active && u.role !== "readonly")
        );
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load users — check the connection and try again.");
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const byRole = clinicalRank(a.clinicalRole) - clinicalRank(b.clinicalRole);
        if (byRole !== 0) return byRole;
        return a.displayName.localeCompare(b.displayName);
      }),
    [users]
  );

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
          disabled={loadState !== "ready" || sortedUsers.length === 0}
        >
          {loadState === "loading" ? (
            <option value="">Loading users…</option>
          ) : loadState === "error" ? (
            <option value="">Could not load users</option>
          ) : sortedUsers.length === 0 ? (
            <option value="">No active users available</option>
          ) : (
            <>
              <option value="">— select a user —</option>
              {sortedUsers.map((u) => {
                const clinical =
                  u.clinicalRole && u.clinicalRole !== "unset"
                    ? CLINICAL_ROLE_LABEL[u.clinicalRole]
                    : null;
                return (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.username})
                    {clinical ? ` · ${clinical}` : ""}
                  </option>
                );
              })}
            </>
          )}
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
            disabled={busy || !toUserId || loadState !== "ready"}
            onClick={() => void submit()}
          >
            Transfer
          </button>
        </div>
      </div>
    </Dialog>
  );
}
