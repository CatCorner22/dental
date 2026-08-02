"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { generatePassword } from "@/lib/auth/genPassword";
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
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Update failed.");
    } catch {
      setError("Update failed — check the connection and try again.");
    }
    router.refresh();
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete ${row.username}? This cannot be undone.`)) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, { method: "DELETE" });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Delete failed.");
    } catch {
      setError("Delete failed — check the connection and try again.");
    }
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

// One field for a temporary password: generate (visible + copyable) or type
// your own. Generating saves ~30 keystrokes and avoids weak hand-made ones.
function TempPasswordField({
  label,
  password,
  setPassword,
  inputId
}: {
  label: string;
  password: string;
  setPassword: (p: string) => void;
  inputId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const gen = () => {
    setPassword(generatePassword());
    setVisible(true);
    setCopied(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setVisible(true); // clipboard blocked — at least show it for hand-copy
    }
  };
  return (
    <div>
      <label className="field-label" htmlFor={inputId}>{label}</label>
      <div className="flex gap-1.5">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="button" className="btn-secondary shrink-0" onClick={gen} title="Generate a strong temporary password">
          Generate
        </button>
        <button type="button" className="btn-secondary shrink-0" onClick={copy} disabled={!password} title="Copy to clipboard">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
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
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName, password, role })
      });
      if (res.ok) return onDone();
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Create failed.");
    } catch {
      setError("Create failed — check the connection and try again.");
    }
    setBusy(false);
  };
  return (
    <Dialog title="Add user" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="field-label" htmlFor="au-user">Username</label><input id="au-user" className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="au-name">Display name</label><input id="au-name" className="field-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        <TempPasswordField label="Temporary password (10+ chars)" password={password} setPassword={setPassword} inputId="au-pass" />
        <div>
          <label className="field-label" htmlFor="au-role">Role</label>
          <select id="au-role" className="field-input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || password.length < 10} onClick={submit}>{busy ? "Adding…" : "Add user"}</button>
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
    try {
      const res = await fetch(`/api/admin/users/${row.id}/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (res.ok) return setDone(true);
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Reset failed.");
    } catch {
      setError("Reset failed — check the connection and try again.");
    }
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
          <TempPasswordField label="New password (10+ chars)" password={password} setPassword={setPassword} inputId="rp-pass" />
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
