import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAllSubmissions, listSubmissionsByUser } from "@/lib/db/repo/submissions";
import { formatTicket } from "@/lib/tickets/ticket";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const rows =
    guard.user.role === "user"
      ? await listSubmissionsByUser(db, guard.user.id)
      : await listAllSubmissions(db);
  return Response.json({
    submissions: rows.map((s) => ({
      id: s.id,
      ticket: formatTicket(s.id),
      submittedByName: s.submittedByName,
      submittedAtEt: s.submittedAtEt,
      auditStatus: s.auditStatus,
      ruleVersion: s.ruleVersion
    }))
  });
}
