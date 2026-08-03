import { redirect } from "next/navigation";
import { seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import {
  countAllSubmissions,
  listAllSubmissions,
  listSubmissionsByUser,
  submissionCountByUser
} from "@/lib/db/repo/submissions";
import { formatTicket } from "@/lib/tickets/ticket";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import { HistoryTable } from "@/components/history/HistoryTable";

export const runtime = "nodejs";
export const metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  const mine = !seesAllNotes(user.role);
  const rows = mine
    ? await listSubmissionsByUser(db, user.id)
    : await listAllSubmissions(db);
  // Bounded to one page; the total is fetched so the truncation is stated
  // rather than implied.
  const total = mine ? await submissionCountByUser(db, user.id) : await countAllSubmissions(db);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Submission history</h1>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No submissions yet. {sparkleLine("empty", daySeed(new Date()))}
        </p>
      ) : (
        <>
          {total > rows.length && (
            <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Showing the {rows.length} most recent of {total} submissions.
            </p>
          )}
          <HistoryTable
            rows={rows.map((s) => ({
            id: s.id,
            ticket: formatTicket(s.id),
            label: s.filename,
            by: s.submittedByName,
            at: s.submittedAtEt,
              status: s.auditStatus,
              rules: s.ruleVersion
            }))}
          />
        </>
      )}
    </div>
  );
}
