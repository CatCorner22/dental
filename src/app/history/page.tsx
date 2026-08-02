import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { listAllSubmissions, listSubmissionsByUser } from "@/lib/db/repo/submissions";
import { formatTicket } from "@/lib/tickets/ticket";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

export const runtime = "nodejs";
export const metadata = { title: "History — Dental Note Builder" };

export default async function HistoryPage() {
  const session = await auth();
  const user = session!.user;
  const db = await getDb();
  const rows =
    user.role === "user"
      ? await listSubmissionsByUser(db, user.id)
      : await listAllSubmissions(db);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Submission history</h1>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No submissions yet. {sparkleLine("empty", daySeed(new Date()))}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Submitted by</th>
                <th className="px-3 py-2">Eastern time</th>
                <th className="px-3 py-2">Audit status</th>
                <th className="px-3 py-2">Rules</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link href={`/history/${s.id}`} className="text-blue-700 hover:underline">
                      {formatTicket(s.id)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.submittedByName}</td>
                  <td className="px-3 py-2">{s.submittedAtEt}</td>
                  <td className="px-3 py-2 text-xs">{s.auditStatus}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.ruleVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
