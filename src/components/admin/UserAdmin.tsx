"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { ExportButton } from "@/components/export/ExportButton";
import { generatePassword } from "@/lib/auth/genPassword";
import { emailPolicyError } from "@/lib/auth/emails";
import {
  canAddUser,
  canAssignRole,
  canDeactivate,
  canDeleteUser,
  canActOn,
  canEditContact,
  canManageUsers,
  canMergeUsers,
  canReceiveTransfer,
  canSendResetLink,
  canSetPasswordDirectly,
  requiresTwoEmails,
  ROLE_LABEL,
  type Role
} from "@/lib/auth/roles";
import {
  ASSIGNABLE_CLINICAL_ROLES,
  canAssignClinicalRole,
  CLINICAL_ROLE_HINT,
  CLINICAL_ROLE_LABEL,
  resolveClinicalRole,
  type ClinicalRole
} from "@/lib/auth/clinicalRoles";

interface Row {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  // Present only for accounts this viewer may send a reset link to — the
  // address is the delivery target for an account takeover, so it is not
  // broadcast to every user manager.
  email?: string | null;
  groupEmail?: string | null;
  // Which offices this person works at. Shown to everyone who may manage the
  // account — unlike an email address, an assignment grants nothing and is
  // simply a fact about the rota.
  officeIds: string[];
  clinicalRole: ClinicalRole;
}

const ROLES: Role[] = ["readonly", "user", "lead", "manager", "admin"];

// Every affordance on this screen is derived HERE, from the same predicates the
// API enforces, and then rendered twice (cards on a phone, a table on a laptop).
// Deriving it once is the point: the previous screen hardcoded its buttons, so
// a Team Lead was shown "Set password" and "Delete" that could only ever 403,
// and was shown no way at all to do the things they actually may do.
//
// Hiding a button is courtesy, not security. Each route re-checks.
interface Perms {
  isSelf: boolean;
  roleOptions: Role[];
  canChangeRole: boolean;
  showDeactivate: boolean;
  showLink: boolean;
  showSetPassword: boolean;
  showContact: boolean;
  showOffices: boolean;
  showClinicalRole: boolean;
  clinicalRoleOptions: ClinicalRole[];
  showMerge: boolean;
  showDelete: boolean;
}

function permsFor(u: Row, selfId: string, selfRole: Role): Perms {
  const isSelf = u.id === selfId;
  const roleOptions = ROLES.filter((r) => r === u.role || canAssignRole(selfRole, u.role, r));
  return {
    isSelf,
    roleOptions,
    // Only offer the control when there is somewhere else to GO. A Hierarchy
    // Manager may only ever assign "Team Lead", so on a Team Lead row this
    // would otherwise be a one-option select that does nothing.
    canChangeRole: !isSelf && roleOptions.length > 1,
    showDeactivate: !isSelf && canDeactivate(selfRole, u.role),
    // A deactivated account cannot sign in, so a link mailed to it is a dead
    // end — the route refuses it, and the button should not invite the attempt.
    showLink: !isSelf && u.active && canSendResetLink(selfRole, u.role),
    showSetPassword: canSetPasswordDirectly(selfRole),
    showContact: canEditContact(selfRole, u.role),
    // Anyone who may manage this account may set its offices. Deliberately a
    // LOWER bar than contact details: an assignment is not a takeover vector,
    // it grants no access, and it decides only what order the note picker
    // shows locations in.
    showOffices: canManageUsers(selfRole) && canActOn(selfRole, u.role),
    // Scope of practice is a statement about what someone may write in a
    // clinical record, so unlike an office assignment it is NOT self-service —
    // same ceiling as every other account field.
    showClinicalRole: !isSelf && canActOn(selfRole, u.role),
    // The developer tier is not a Tennessee credential and is not a Hierarchy
    // Manager's to hand out, so it only appears in the picker for a Smile Notes
    // Developer. Keep it listed when the target already HOLDS it, or a manager
    // opening the row would see a <select> whose value is not among its options
    // and silently reset the account to whatever renders first.
    clinicalRoleOptions: ASSIGNABLE_CLINICAL_ROLES.concat(
      canAssignClinicalRole(selfRole, "smilenotes") ||
        resolveClinicalRole(u.role, u.clinicalRole) === "smilenotes"
        ? ["smilenotes"]
        : []
    ),
    showMerge: !isSelf && u.active && canMergeUsers(selfRole, u.role),
    showDelete: !isSelf && canDeleteUser(selfRole, u.role)
  };
}

function hasActions(p: Perms): boolean {
  return (
    p.isSelf ||
    p.showDeactivate ||
    p.showLink ||
    p.showSetPassword ||
    p.showContact ||
    p.showMerge ||
    p.showDelete
  );
}

interface RowHandlers {
  patch: (id: string, body: Record<string, unknown>) => void;
  remove: (row: Row) => void;
  onLink: (row: Row) => void;
  onSetPassword: (row: Row) => void;
  onContact: (row: Row) => void;
  onOffices: (row: Row) => void;
  onClinicalRole: (row: Row, role: ClinicalRole) => void;
  onMerge: (row: Row) => void;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-600"}`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RoleControl({
  user,
  perms,
  onChange
}: {
  user: Row;
  perms: Perms;
  onChange: (role: Role) => void;
}) {
  if (!perms.canChangeRole) {
    return (
      <span
        className="inline-block py-1 text-sm"
        title={perms.isSelf ? "You cannot change your own role" : undefined}
      >
        {ROLE_LABEL[user.role]}
      </span>
    );
  }
  return (
    <select
      // field-input, not a hand-rolled 12px control: below sm that class is
      // 16px, which is what stops iOS Safari zooming the page in on focus and
      // never zooming back out.
      className="field-input w-auto"
      value={user.role}
      onChange={(e) => onChange(e.target.value as Role)}
      aria-label={`Role for ${user.username}`}
    >
      {/* The current role is always listed so the control shows where the
          account stands, even when this actor could not newly assign it. */}
      {perms.roleOptions.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

function RowActions({
  user,
  perms,
  handlers
}: {
  user: Row;
  perms: Perms;
  handlers: RowHandlers;
}) {
  // A Smile Notes Developer with nothing recorded holds the developer tier by
  // derivation, not by a stored value — show what the account actually has, or
  // this row says "Not recorded" about an account the rest of the app is
  // treating as unrestricted.
  const effective = resolveClinicalRole(user.role, user.clinicalRole);
  // Real tap targets with padding between them. These were bare ~16px text
  // links, and "Delete" sat directly beside "Deactivate" — a near-miss on a
  // phone destroyed an account instead of suspending one.
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
      {perms.showDeactivate && (
        <button
          className="tap rounded px-2 text-brand-blue hover:underline"
          onClick={() => handlers.patch(user.id, { active: !user.active })}
        >
          {user.active ? "Deactivate" : "Reactivate"}
        </button>
      )}
      {perms.showLink && (
        <button
          className="tap rounded px-2 text-brand-blue hover:underline"
          onClick={() => handlers.onLink(user)}
        >
          Send reset link
        </button>
      )}
      {perms.showSetPassword && (
        <button
          className="tap rounded px-2 text-brand-blue hover:underline"
          onClick={() => handlers.onSetPassword(user)}
        >
          Set password
        </button>
      )}
      {perms.showContact && (
        <button
          className="tap rounded px-2 text-brand-blue hover:underline"
          onClick={() => handlers.onContact(user)}
        >
          Edit contact
        </button>
      )}
      {perms.showOffices && (
        <button
          className="tap rounded px-2 text-brand-blue hover:underline"
          onClick={() => handlers.onOffices(user)}
        >
          Offices
        </button>
      )}
      {perms.showClinicalRole && (
        <select
          className="tap rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
          value={effective}
          aria-label={`Clinical role for ${user.username}`}
          title={CLINICAL_ROLE_HINT[effective]}
          onChange={(e) => handlers.onClinicalRole(user, e.target.value as ClinicalRole)}
        >
          {perms.clinicalRoleOptions.map((r) => (
            <option key={r} value={r}>
              {CLINICAL_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      )}
      {perms.showMerge && (
        <button
          className="tap rounded px-2 text-brand-blue hover:underline"
          onClick={() => handlers.onMerge(user)}
        >
          Merge away
        </button>
      )}
      {perms.showDelete && (
        <button
          className="tap rounded px-2 text-rose-700 hover:underline"
          onClick={() => handlers.remove(user)}
        >
          Delete
        </button>
      )}
      {perms.isSelf && <span className="px-2 text-slate-500">(you)</span>}
    </div>
  );
}

// Shared fetch wrapper: every mutation here reports the server's own message
// rather than a generic "failed", because the server messages are the ones that
// explain WHY an action was refused ("You cannot create a Hierarchy Manager
// account"), which is the whole point of a capability-scoped screen.
async function send(
  url: string,
  init: RequestInit
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, init);
    if (res.status === 204) return { ok: true, data: {} };
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data };
    return { ok: false, error: (data.error as string) ?? "That did not work." };
  } catch {
    return { ok: false, error: "Network problem — check the connection and try again." };
  }
}

export function UserAdmin({
  users,
  selfId,
  selfRole,
  offices
}: {
  users: Row[];
  selfId: string;
  selfRole: Role;
  offices: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [setPasswordFor, setSetPasswordFor] = useState<Row | null>(null);
  const [linkFor, setLinkFor] = useState<Row | null>(null);
  const [mergeFrom, setMergeFrom] = useState<Row | null>(null);
  const [contactFor, setContactFor] = useState<Row | null>(null);
  const [officesFor, setOfficesFor] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Which roles may this actor mint at all? If none, the Add button would only
  // ever produce a 403, so it is not shown.
  const addableRoles = useMemo(() => ROLES.filter((r) => canAddUser(selfRole, r)), [selfRole]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError("");
    setNotice("");
    const res = await send(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) setError(res.error);
    router.refresh();
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete ${row.username}? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    const res = await send(`/api/admin/users/${row.id}`, { method: "DELETE" });
    if (!res.ok) setError(res.error);
    router.refresh();
  };

  const handlers: RowHandlers = {
    patch,
    remove,
    onLink: setLinkFor,
    onSetPassword: setSetPasswordFor,
    onContact: setContactFor,
    onOffices: setOfficesFor,
    onClinicalRole: (row: Row, clinicalRole: ClinicalRole) =>
      void patch(row.id, { clinicalRole }),
    onMerge: setMergeFrom
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Users</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton table="users" />
          {addableRoles.length > 0 && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + Add user
            </button>
          )}
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        You are signed in as a <strong>{ROLE_LABEL[selfRole]}</strong>. You will only see actions
        for accounts you are allowed to manage.
      </p>
      {error && (
        <p className="mb-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}
      {/* Two layouts, one set of rules. Below `sm` this is a card list: a
          five-column table on a 375px phone pushed the whole Actions column off
          screen behind a horizontal scroll INSIDE the container. The page
          reported no overflow, so it looked correct, while "Send reset link"
          was unreachable without discovering a swipe nothing hinted at. */}
      <ul className="space-y-2 sm:hidden">
        {users.map((u) => {
          const perms = permsFor(u, selfId, selfRole);
          return (
            <li key={u.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm">{u.username}</span>
                <StatusPill active={u.active} />
              </div>
              <p className="mt-0.5 text-sm text-slate-700">{u.displayName}</p>
              {u.email && <p className="break-all text-xs text-slate-500">{u.email}</p>}
              <div className="mt-2">
                <RoleControl user={u} perms={perms} onChange={(role) => patch(u.id, { role })} />
              </div>
              {/* No divider when there is nothing under it. An empty bordered
                  strip on every account this viewer cannot touch reads as a
                  card that failed to load. */}
              {hasActions(perms) && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <RowActions user={u} perms={perms} handlers={handlers} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="card hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th scope="col" className="px-3 py-2">Username</th>
              <th scope="col" className="px-3 py-2">Display name</th>
              <th scope="col" className="px-3 py-2">Role</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const perms = permsFor(u, selfId, selfRole);
              return (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-mono">{u.username}</td>
                  <td className="px-3 py-2">
                    {u.displayName}
                    {u.email && <span className="block text-xs text-slate-500">{u.email}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <RoleControl user={u} perms={perms} onChange={(role) => patch(u.id, { role })} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill active={u.active} />
                  </td>
                  <td className="px-3 py-2">
                    <RowActions user={u} perms={perms} handlers={handlers} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-slate-500">
        <li>
          Deleting a user is blocked while they own Smile Notes — transfer those first. The last
          active Smile Notes Developer cannot be demoted, deactivated, or deleted.
        </li>
        <li>
          <strong>Merge away</strong> moves that account&rsquo;s in-progress Smile Notes to the
          account you keep and deactivates the duplicate. Filed notes keep the name that signed
          them — that attribution is a permanent record and is never rewritten.
        </li>
        {!canSetPasswordDirectly(selfRole) && (
          <li>
            You reset access by emailing a link. You never see or choose anyone&rsquo;s password,
            and the link lets them set their own.
          </li>
        )}
        {!canEditContact(selfRole, "user") && (
          <li>
            Changing the email on an existing account needs a Hierarchy Manager, because whoever
            controls the address can receive that account&rsquo;s reset link.
          </li>
        )}
      </ul>

      {showAdd && (
        <AddUserDialog
          selfRole={selfRole}
          addableRoles={addableRoles}
          onClose={() => setShowAdd(false)}
          onDone={(message) => {
            setShowAdd(false);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
      {setPasswordFor && (
        <SetPasswordDialog row={setPasswordFor} onClose={() => setSetPasswordFor(null)} />
      )}
      {linkFor && (
        <ResetLinkDialog
          row={linkFor}
          onClose={() => setLinkFor(null)}
          onSent={(message) => {
            setLinkFor(null);
            setNotice(message);
          }}
        />
      )}
      {officesFor && (
        <OfficesDialog
          row={officesFor}
          offices={offices}
          onClose={() => setOfficesFor(null)}
          onDone={(m) => {
            setOfficesFor(null);
            setNotice(m);
            router.refresh();
          }}
        />
      )}
      {contactFor && (
        <ContactDialog
          row={contactFor}
          onClose={() => setContactFor(null)}
          onDone={(message) => {
            setContactFor(null);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
      {mergeFrom && (
        <MergeDialog
          source={mergeFrom}
          users={users}
          selfRole={selfRole}
          onClose={() => setMergeFrom(null)}
          onDone={(message) => {
            setMergeFrom(null);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// One field for a temporary password: generate (visible + copyable) or type
// your own. Generating saves ~30 keystrokes and avoids weak hand-made ones.
// Only ever rendered for a Smile Notes Developer — nobody else may set one.
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
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="flex gap-1.5">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={gen}
          title="Generate a strong temporary password"
        >
          Generate
        </button>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={copy}
          disabled={!password}
          title="Copy to clipboard"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function AddUserDialog({
  selfRole,
  addableRoles,
  onClose,
  onDone
}: {
  selfRole: Role;
  addableRoles: Role[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [groupEmail, setGroupEmail] = useState("");
  // Default to the LOWEST role this actor may create, not a hardcoded "user":
  // a Hierarchy Manager may only ever mint Team Leads, so "user" would have
  // pre-selected an option that is guaranteed to be refused.
  const [role, setRole] = useState<Role>(addableRoles[0] ?? "user");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Developers may still set a password directly (the original flow). Everyone
  // else invites: the account is created unreachable and a set-password link is
  // mailed, so a practice manager never handles a credential.
  const mayTypePassword = canSetPasswordDirectly(selfRole);
  const needsGroupEmail = requiresTwoEmails(role);
  // With no password field, the invite email IS the only way in, so it is
  // required rather than optional.
  const emailRequired = !mayTypePassword || password === "";

  const clientError = (): string | null => {
    if (!username.trim()) return "Pick a username.";
    if (emailRequired && !email.trim()) {
      return "An email address is required so they can be sent a link to set their own password.";
    }
    return emailPolicyError(role, { email: email.trim() || null, groupEmail: groupEmail.trim() || null });
  };

  const submit = async () => {
    const bad = clientError();
    if (bad) return setError(bad);
    setBusy(true);
    setError("");
    const res = await send("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        displayName,
        role,
        email: email.trim(),
        groupEmail: groupEmail.trim(),
        // Never send an empty string when this actor may not set one — the
        // server rejects any password from a non-Developer outright.
        ...(mayTypePassword && password ? { password } : {})
      })
    });
    if (res.ok) {
      // `invited: false` means the account exists but the mail did not go out.
      // Saying "added" alone would leave someone waiting for an email that is
      // never coming.
      const invited = res.data.invited;
      return onDone(
        invited === false
          ? `${username} was created, but the invite email could not be sent. Use “Send reset link” once email is working.`
          : invited === true
            ? `${username} was created and a set-password link was emailed to ${email.trim()}.`
            : `${username} was created.`
      );
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <Dialog title="Add user" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="field-label" htmlFor="au-user">
            Username
          </label>
          <input
            id="au-user"
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="au-name">
            Display name
          </label>
          <input
            id="au-name"
            className="field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="au-role">
            Role
          </label>
          <select
            id="au-role"
            className="field-input"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {addableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="au-email">
            Email {emailRequired ? "" : <span className="text-slate-500">(optional)</span>}
          </label>
          <input
            id="au-email"
            className="field-input"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {needsGroupEmail && (
          <div>
            <label className="field-label" htmlFor="au-group">
              Management group email
            </label>
            <input
              id="au-group"
              className="field-input"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={groupEmail}
              onChange={(e) => setGroupEmail(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              A Hierarchy Manager is the practice&rsquo;s escalation path, so they need a second,
              different address that reaches more than one person.
            </p>
          </div>
        )}
        {mayTypePassword ? (
          <TempPasswordField
            label="Temporary password (any mix, 10+ chars — or leave blank to email a link)"
            password={password}
            setPassword={setPassword}
            inputId="au-pass"
          />
        ) : (
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            They will be emailed a link to set their own password. You never see or choose it.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Adding…" : "Add user"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// Emailing a link — the only reset a Team Lead or Hierarchy Manager may perform.
// Deliberately shows no token and no password: the response carries neither.
function ResetLinkDialog({
  row,
  onClose,
  onSent
}: {
  row: Row;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await send(`/api/admin/users/${row.id}/reset-link`, { method: "POST" });
    if (res.ok) {
      const to = (res.data.sentTo as string) || "their address on file";
      return onSent(`A reset link was emailed to ${to}. It can be used once, and it expires.`);
    }
    setError(res.error);
    setBusy(false);
  };
  return (
    <Dialog title={`Send reset link — ${row.username}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          This emails <strong>{row.email || "the address on file"}</strong> a single-use link so{" "}
          {row.displayName} can set their own password. You will not see the link or the password,
          and signing in with the link ends every session that account already had.
        </p>
        {!row.email && (
          <p className="text-sm text-amber-800">
            No email address is on file for this account, so the link cannot be delivered. A
            Hierarchy Manager can add one.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || !row.email} onClick={submit}>
            {busy ? "Sending…" : "Send link"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// Developer-only: choose a password directly. Kept because a developer may need
// to restore access on a deployment where email is not configured at all.
function SetPasswordDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await send(`/api/admin/users/${row.id}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (res.ok) return setDone(true);
    setError(res.error);
    setBusy(false);
  };
  return (
    <Dialog title={`Set password — ${row.username}`} onClose={onClose}>
      {done ? (
        <div>
          <p className="mb-3 text-sm text-green-800">
            Password set. Share it securely, and note that every session this account had is now
            signed out.
          </p>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Prefer <strong>Send reset link</strong> where email works — it means nobody but the
            account holder ever knows the password.
          </p>
          <TempPasswordField
            label="New password (10+ chars)"
            password={password}
            setPassword={setPassword}
            inputId="rp-pass"
          />
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || password.length < 10} onClick={submit}>
              {busy ? "Setting…" : "Set password"}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ContactDialog({
  row,
  onClose,
  onDone
}: {
  row: Row;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [email, setEmail] = useState(row.email ?? "");
  const [groupEmail, setGroupEmail] = useState(row.groupEmail ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const needsGroupEmail = requiresTwoEmails(row.role);
  const submit = async () => {
    const bad = emailPolicyError(row.role, {
      email: email.trim() || null,
      groupEmail: groupEmail.trim() || null
    });
    if (bad) return setError(bad);
    setBusy(true);
    setError("");
    const res = await send(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), groupEmail: groupEmail.trim() })
    });
    if (res.ok) return onDone(`Contact details updated for ${row.username}.`);
    setError(res.error);
    setBusy(false);
  };
  return (
    <Dialog title={`Contact details — ${row.username}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-amber-800">
          This address is where a password-reset link is delivered. Changing it changes who can
          recover this account, so the change is recorded in the audit log.
        </p>
        <div>
          <label className="field-label" htmlFor="ct-email">
            Email
          </label>
          <input
            id="ct-email"
            className="field-input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {needsGroupEmail && (
          <div>
            <label className="field-label" htmlFor="ct-group">
              Management group email
            </label>
            <input
              id="ct-group"
              className="field-input"
              type="email"
              inputMode="email"
              value={groupEmail}
              onChange={(e) => setGroupEmail(e.target.value)}
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function MergeDialog({
  source,
  users,
  selfRole,
  onClose,
  onDone
}: {
  source: Row;
  users: Row[];
  selfRole: Role;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // The account being kept must be one this actor may also act on, must be able
  // to own notes (never read-only), and must be active — the same three rules
  // the server applies, so the picker cannot offer a choice that will 409.
  const candidates = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== source.id &&
          u.active &&
          canReceiveTransfer(u.role) &&
          canMergeUsers(selfRole, u.role)
      ),
    [users, source.id, selfRole]
  );
  const [targetId, setTargetId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const target = candidates.find((c) => c.id === targetId);

  const submit = async () => {
    if (!targetId) return setError("Pick the account to keep.");
    setBusy(true);
    setError("");
    const res = await send("/api/admin/users/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: source.id, targetId })
    });
    if (res.ok) {
      const moved = Number(res.data.draftsMoved ?? 0);
      const kept = Number(res.data.submissionsKept ?? 0);
      return onDone(
        `Merged ${source.username} into ${target?.username ?? "the kept account"} — ${moved} in-progress Smile Note${moved === 1 ? "" : "s"} moved, ${kept} filed note${kept === 1 ? "" : "s"} kept the original signature.`
      );
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <Dialog title={`Merge away — ${source.username}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          Use this when <strong>{source.displayName}</strong> ended up with a duplicate account.
          In-progress Smile Notes move to the account you keep; <strong>{source.username}</strong>{" "}
          is then deactivated.
        </p>
        <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          Already-filed notes are <strong>not</strong> reassigned. They keep the name that signed
          them, because that is a permanent record of who documented the care.
        </p>
        {candidates.length === 0 ? (
          <p className="text-sm text-amber-800">
            There is no other active account you can merge into. The account you keep has to be one
            you are allowed to manage and one that can own notes.
          </p>
        ) : (
          <div>
            <label className="field-label" htmlFor="mg-target">
              Account to keep
            </label>
            <select
              id="mg-target"
              className="field-input"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({c.username}) — {ROLE_LABEL[c.role]}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={busy || candidates.length === 0}
            onClick={submit}
          >
            {busy ? "Merging…" : "Merge"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}


// Which offices a person works at.
//
// A SET, not a single choice: staff rotate, and most people genuinely belong to
// more than one location. Nothing here restricts anything — every office stays
// selectable on every note regardless of what is ticked. The assignment orders
// that picker so somebody's own locations come first, and answers "who works
// where" without anyone having to ask.
function OfficesDialog({
  row,
  offices,
  onClose,
  onDone
}: {
  row: Row;
  offices: { id: string; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(row.officeIds);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await send(`/api/admin/users/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ officeIds: selected })
    });
    if (res.ok) {
      return onDone(
        selected.length === 0
          ? `${row.username} is not assigned to an office.`
          : `${row.username} works at ${selected.length} office${selected.length === 1 ? "" : "s"}.`
      );
    }
    setError(res.error);
    setBusy(false);
  };
  return (
    <Dialog title={`Offices — ${row.username}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Tick every office this person works at. This does not restrict anything — every office
          stays available on every note, because a patient may be seen anywhere and cover gets
          arranged at short notice. It puts their own locations first in the picker.
        </p>
        {offices.length === 0 ? (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No offices are configured yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {offices.map((o) => (
              <li key={o.id}>
                <label className="tap flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selected.includes(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  {o.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save offices"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
}
