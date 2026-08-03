import { redirect } from "next/navigation";
import { canReadAuditLog } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { listAuditLog } from "@/lib/db/repo/auditLog";
import { listUsers } from "@/lib/db/repo/users";

export const runtime = "nodejs";
export const metadata = { title: "Audit log" };

const ACTION_LABEL: Record<string, string> = {
  "setup.first-admin": "First admin created",
  "user.create": "User created",
  "user.update": "User updated",
  "user.delete": "User deleted",
  "user.reset-password": "Password reset (by admin)",
  "user.self-password": "Password changed (self)",
  "draft.transfer": "Draft transferred",
  "draft.delete": "Draft deleted",
  "notice.ack": "Notice acknowledged",
  submit: "Note submitted",
  "submit.email-failed": "Note submitted (email failed)",
  "submit.no-email": "Note submitted (email off)",
  "submit.phi-override": "Privacy stop overridden (attested)"
};

export default async function AuditLogPage() {
  const user = await freshSessionUser(); // fresh role — a demoted admin loses this page NOW
  if (!user) redirect("/login");
  if (!canReadAuditLog(user.role)) redirect("/");
  const db = await getDb();
  const [log, users] = await Promise.all([listAuditLog(db, 300), listUsers(db)]);
  const nameById = new Map(users.map((u) => [u.id, `${u.displayName} (${u.username})`]));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Audit log</h1>
      <p className="mb-4 text-sm text-slate-600">
        User-management and submission events, newest first. This log supports traceability; it
        contains no patient data.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">When (UTC)</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{e.at.toISOString().replace("T", " ").slice(0, 16)}</td>
                {/* The FROZEN name wins. Rendering the live account name meant
                    renaming an account rewrote how its entire history read —
                    an audit log that changes retroactively is not an audit
                    log. The current name is shown underneath only when it
                    differs, so a reader can still tell who that is today. */}
                <td className="px-3 py-2">
                  {e.actorId ? (
                    <>
                      <span>{e.actorName ?? nameById.get(e.actorId) ?? "unknown"}</span>
                      {e.actorName && nameById.get(e.actorId) !== e.actorName && (
                        <span className="block text-xs text-slate-400">
                          {nameById.has(e.actorId)
                            ? `now ${nameById.get(e.actorId)}`
                            : "account deleted"}
                        </span>
                      )}
                    </>
                  ) : (
                    "system"
                  )}
                </td>
                <td className="px-3 py-2">{ACTION_LABEL[e.action] ?? e.action}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.target ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{e.detail ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {log.length === 0 && <p className="mt-3 text-sm text-slate-500">No events yet.</p>}
      {log.length === 300 && (
        <p className="mt-3 text-sm text-slate-500">
          Showing the latest 300 events. Older events stay in the database.
        </p>
      )}
    </div>
  );
}
