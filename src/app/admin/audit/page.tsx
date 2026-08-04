import { redirect } from "next/navigation";
import { canReadAuditLog } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { listAuditLog, listAuditLogByAction, type AuditFilter } from "@/lib/db/repo/auditLog";
import { ExportButton } from "@/components/export/ExportButton";
import { listUsers } from "@/lib/db/repo/users";
import { DriftPanel } from "@/components/admin/DriftPanel";
import { decodeDriftDetail } from "@/lib/assist/drift";

export const runtime = "nodejs";
export const metadata = { title: "Audit log" };

const ACTION_LABEL: Record<string, string> = {
  "setup.first-admin": "First admin created",
  "auth.signin": "Signed in",
  "auth.failed": "Failed sign-in",
  "auth.lockout": "Sign-in locked (too many attempts)",
  "auth.revoke-sessions": "Signed out all devices",
  "user.reset-link-sent": "Reset link sent",
  "user.reset-link-failed": "Reset link failed",
  "user.invite-sent": "Invite sent",
  "user.invite-failed": "Invite failed",
  "user.merge": "Users merged",
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
  "submit.phi-override": "Privacy stop overridden (attested)",
  "assist.used": "AI assist used",
  "assist.drift": "AI assist outcome (drift monitor)",
  "assist.fact-decision": "Pinned fact accepted into a note (count only)"
};

const FILTERS: { key: AuditFilter; label: string }[] = [
  { key: "all", label: "All events" },
  { key: "security", label: "Security" },
  { key: "auth", label: "Sign-ins" }
];

export default async function AuditLogPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await freshSessionUser(); // fresh role — a demoted admin loses this page NOW
  if (!user) redirect("/login");
  if (!canReadAuditLog(user.role)) redirect("/");
  const { filter: raw } = await searchParams;
  const filter: AuditFilter = raw === "auth" || raw === "security" ? raw : "all";
  const db = await getDb();
  const [log, users, driftRows, factDecisionRows] = await Promise.all([
    listAuditLog(db, 300, filter),
    listUsers(db),
    // A far wider window than the visible table, and filtered in SQL: a refusal
    // rate computed over "the last 300 events" is a rate over whatever happened
    // to be recent, and drift is a trend.
    listAuditLogByAction(db, "assist.drift", 2000),
    // The human half of the extraction-precision loop: count-only acceptance
    // beacons, aggregated into the panel's acceptance rate.
    listAuditLogByAction(db, "assist.fact-decision", 2000)
  ]);
  const nameById = new Map(users.map((u) => [u.id, `${u.displayName} (${u.username})`]));

  // Rows that are not drift rows decode to null and are dropped — reading one of
  // those as drift would silently poison every rate on the panel.
  const driftEvents = driftRows.flatMap((row) => {
    if (!row.detail) return [];
    const parsed = decodeDriftDetail(row.detail);
    // A row whose detail does not parse is dropped rather than guessed at —
    // reading a non-drift row as drift would silently poison every rate shown.
    return parsed ? [{ ...parsed, at: row.at }] : [];
  });

  return (
    <div>
      <h1 className="page-title mb-1">Audit log</h1>
      <p className="mb-4 text-sm text-slate-600">
        Sign-ins, user-management, and submission events, newest first. This log supports
        traceability; it contains no patient data.
      </p>
      <DriftPanel events={driftEvents} factAcceptances={factDecisionRows.length} />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <a
            key={f.key}
            href={f.key === "all" ? "/admin/audit" : `/admin/audit?filter=${f.key}`}
            className={`tap rounded-full border px-3 text-sm ${
              filter === f.key
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {f.label}
          </a>
        ))}
        <span className="ml-auto">
          <ExportButton
            table="audit-log"
            query={filter === "all" ? undefined : { filter }}
            label={filter === "all" ? "Export to Excel (CSV)" : "Export this view (CSV)"}
          />
        </span>
      </div>
      <div
        className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200"
        tabIndex={0}
        role="region"
        aria-label="Audit log — scrolls sideways for more columns"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th scope="col" className="px-3 py-2">When (UTC)</th>
              <th scope="col" className="px-3 py-2">Actor</th>
              <th scope="col" className="px-3 py-2">Action</th>
              <th scope="col" className="px-3 py-2">Target</th>
              <th scope="col" className="px-3 py-2">Detail</th>
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
