"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import type { Role } from "@/lib/auth/roles";

interface Row {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  readonly: "Read only",
  user: "User (edit)",
  admin: "Admin"
};

export function UserAdmin({ users, selfId }: { users: Row[]; selfId: string }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [error, setError] = useState("");

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError("");
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Update failed.");
    router.refresh();
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete ${row.username}? This cannot be undone.`)) return;
    setError("");
    const res = await fetch(`/api/admin/users/${row.id}`, { method: "DELETE" });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Delete failed.");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add user</button>
      </div>
      {error && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Display name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-mono">{u.username}</td>
                <td className="px-3 py-2">{u.displayName}</td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                    value={u.role}
                    disabled={u.id === selfId}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    aria-label={`Role for ${u.username}`}
                    title={u.id === selfId ? "You cannot change your own role" : undefined}
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-600"}`}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {u.id !== selfId && (
                      <button className="text-blue-700 hover:underline" onClick={() => patch(u.id, { active: !u.active })}>
                        {u.active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                    <button className="text-blue-700 hover:underline" onClick={() => setResetFor(u)}>Reset password</button>
                    {u.id !== selfId && (
                      <button className="text-rose-700 hover:underline" onClick={() => remove(u)}>Delete</button>
                    )}
                    {u.id === selfId && <span className="text-slate-400">(you)</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Deleting a user is blocked while they own drafts — transfer those first. The last active
        admin cannot be demoted, deactivated, or deleted.
      </p>

      {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); router.refresh(); }} />}
      {resetFor && <ResetDialog row={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  );
}

function AddUserDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, displayName, password, role })
    });
    if (res.ok) return onDone();
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Create failed.");
    setBusy(false);
  };
  return (
    <Dialog title="Add user" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="field-label">Username</label><input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div><label className="field-label">Display name</label><input className="field-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        <div><label className="field-label">Temporary password (10+ chars)</label><input type="password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div>
          <label className="field-label">Role</label>
          <select className="field-input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Adding…" : "Add user"}</button>
        </div>
      </div>
    </Dialog>
  );
}

function ResetDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/admin/users/${row.id}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (res.ok) return setDone(true);
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Reset failed.");
    setBusy(false);
  };
  return (
    <Dialog title={`Reset password — ${row.username}`} onClose={onClose}>
      {done ? (
        <div>
          <p className="mb-3 text-sm text-green-800">Password reset. Share the new password securely with the user.</p>
          <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <div><label className="field-label">New password (10+ chars)</label><input type="password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy || password.length < 10} onClick={submit}>{busy ? "Resetting…" : "Reset"}</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
