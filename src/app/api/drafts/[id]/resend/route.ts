import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getDraft, setDraftStatus } from "@/lib/db/repo/drafts";
import { getSubmission } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import { sendSubmissionEmail } from "@/lib/email/sendSubmission";
import { formatTicket } from "@/lib/tickets/ticket";
import { checkThrottle, clearThrottle, recordFailure, resendKey } from "@/lib/auth/throttle";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Re-send the email for a note that is ALREADY filed.
//
// This exists so an email outage cannot corrupt the record. Before it, the
// only recovery was to submit again, which filed a second ticket and a second
// frozen copy of an identical note — the permanent record grew one duplicate
// per retry. Resending touches no submission row and mints no ticket: it puts
// the exact frozen copy that was filed back on the wire.
export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  if (guard.user.role !== "admin" && draft.ownerId !== guard.user.id) {
    return Response.json({ error: "You cannot resend this draft." }, { status: 403 });
  }
  if (draft.lastSubmissionId === null) {
    return Response.json(
      { error: "This note has not been filed yet. Submit it first." },
      { status: 409 }
    );
  }
  // Resend exists to recover a FAILED send, nothing more. Without this an
  // authenticated user could replay any delivered note at the corporate
  // address as often as they liked.
  if (!draft.lastSendFailed) {
    return Response.json(
      { error: "This note was already delivered. There is nothing to resend." },
      { status: 409 }
    );
  }
  // Sending mail is an outbound side effect someone else pays for, so it is
  // metered like the other expensive endpoints. During an outage a user will
  // press this repeatedly — that must cost one attempt, not a flood.
  const throttleKey = resendKey(draft.id);
  const throttled = await checkThrottle(db, throttleKey, new Date());
  if (throttled.locked) {
    return Response.json(
      { error: `Too many resend attempts. Try again in ${throttled.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(throttled.retryAfterSec) } }
    );
  }
  const submission = await getSubmission(db, draft.lastSubmissionId);
  if (!submission) {
    return Response.json({ error: "The filed submission is missing." }, { status: 404 });
  }

  const outcome = await sendSubmissionEmail({
    ticket: formatTicket(submission.id),
    filenameBase: submission.filename,
    format: submission.format,
    auditStatus: submission.auditStatus,
    submittedByName: submission.submittedByName,
    submittedAtEt: submission.submittedAtEt,
    // The frozen copies, verbatim — never recomposed. A resend must deliver
    // the document the ticket names, not today's rendering of it.
    frozenNote: submission.noteMarkdown,
    frozenAudit: submission.auditReport
  });

  if (!outcome.attempted) {
    return Response.json(
      { error: "Email is not configured on this deployment." },
      { status: 503 }
    );
  }

  const now = new Date();
  // Meter attempts, not just failures: every press sends real mail, so a
  // success counts toward the budget too. A delivered note clears the streak
  // along with the flag.
  if (outcome.sent) await clearThrottle(db, throttleKey);
  else await recordFailure(db, throttleKey, now);
  // Only a successful send clears the flag; a failed resend leaves the draft
  // exactly as it was so the user can try again.
  await setDraftStatus(db, draft.id, outcome.sent ? "submitted" : "error", !outcome.sent, now);
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: outcome.sent ? "submit.resend" : "submit.resend-failed",
    target: formatTicket(submission.id),
    detail: draft.id
  });

  if (!outcome.sent) {
    return Response.json(
      { error: "The email still could not be sent. The note remains filed — try again shortly." },
      { status: 502 }
    );
  }
  return Response.json({ ok: true, ticket: formatTicket(submission.id), emailed: true });
}
