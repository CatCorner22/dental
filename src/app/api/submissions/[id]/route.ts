import { requireRole } from "@/lib/auth/guards";
import { seesAllNotes } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getSubmission } from "@/lib/db/repo/submissions";
import { parseRowId } from "@/lib/db/int4";
import { formatTicket } from "@/lib/tickets/ticket";

export const runtime = "nodejs";

// ONE frozen submission, for the builder's prior-note comparison pane.
// Same visibility rule as the history page: your own notes, or everything
// when the role already sees all notes. Read-only by construction — there is
// no PATCH here and never will be; filed notes are immutable.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const numId = parseRowId(id);
  if (numId === null) return Response.json({ error: "Not found." }, { status: 404 });
  const db = await getDb();
  const s = await getSubmission(db, numId);
  if (!s) return Response.json({ error: "Not found." }, { status: 404 });
  if (!seesAllNotes(guard.user.role) && s.submittedById !== guard.user.id) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({
    submission: {
      id: s.id,
      ticket: formatTicket(s.id),
      submittedByName: s.submittedByName,
      submittedAtEt: s.submittedAtEt,
      ruleVersion: s.ruleVersion,
      auditStatus: s.auditStatus,
      noteMarkdown: s.noteMarkdown
    }
  });
}
