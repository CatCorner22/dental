import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import {
  countAllSubmissions,
  listAllSubmissions,
  listSubmissionsByUser,
  submissionCountByUser
} from "@/lib/db/repo/submissions";
import { formatTicket } from "@/lib/tickets/ticket";
import { parsePageParams } from "@/lib/http/pagination";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const page = parsePageParams(req.url);
  const mine = guard.user.role === "user";
  const rows = mine
    ? await listSubmissionsByUser(db, guard.user.id, page)
    : await listAllSubmissions(db, page);
  const total = mine
    ? await submissionCountByUser(db, guard.user.id)
    : await countAllSubmissions(db);
  return Response.json({
    submissions: rows.map((s) => ({
      id: s.id,
      ticket: formatTicket(s.id),
      submittedByName: s.submittedByName,
      submittedAtEt: s.submittedAtEt,
      auditStatus: s.auditStatus,
      ruleVersion: s.ruleVersion
    })),
    total,
    limit: page.limit,
    offset: page.offset
  });
}
