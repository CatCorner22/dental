import { requireRole } from "@/lib/auth/guards";
import { seesAllNotes } from "@/lib/auth/roles";
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
  const mine = !seesAllNotes(guard.user.role);
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
      // The frozen office. Dropped here originally, which left the one field a
      // three-office practice most needs to scan for visible in the CSV and
      // nowhere on the screen.
      officeName: s.officeName,
      submittedAtEt: s.submittedAtEt,
      auditStatus: s.auditStatus,
      ruleVersion: s.ruleVersion
    })),
    total,
    limit: page.limit,
    offset: page.offset
  });
}
