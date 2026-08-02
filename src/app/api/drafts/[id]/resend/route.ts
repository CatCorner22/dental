import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { claimResend, getDraft, setDraftStatus } from "@/lib/db/repo/drafts";
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
  const now = new Date();
  const throttled = await checkThrottle(db, throttleKey, now);
  if (throttled.locked) {
    return Response.json(
      { error: `Too many resend attempts. Try again in ${throttled.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(throttled.retryAfterSec) } }
    );
  }

  // Claim BEFORE sending. Two concurrent resends would otherwise both read
  // lastSendFailed=true and both send the frozen copy — one ticket, N emails to
  // the corporate address. The claim flips the flag atomically; exactly one
  // request wins, and a concurrent edit (which also clears the flag) makes the
  // claim miss so a resend never races an edit.
  const claim = await claimResend(db, draft.id, now);
  if (!claim) {
    return Response.json(
      { error: "This note is being resent or was just edited. Reload to see its current state." },
      { status: 409 }
    );
  }

  const submission = await getSubmission(db, claim.lastSubmissionId);
  if (!submission) {
    // Nothing to send — undo the claim so the draft is not stranded as
    // "delivered" with no email out.
    await setDraftStatus(db, draft.id, "error", true, now, claim.version);
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
    // Email not configured: undo the claim (restore the send-failed state) so
    // the draft is not left falsely "delivered".
    await setDraftStatus(db, draft.id, "error", true, now, claim.version);
    return Response.json(
      { error: "Email is not configured on this deployment." },
      { status: 503 }
    );
  }

  // Meter attempts, not just failures: every press sends real mail, so a
  // success counts toward the budget too. A delivered note clears the streak
  // along with the flag.
  if (outcome.sent) await clearThrottle(db, throttleKey);
  else await recordFailure(db, throttleKey, now);
  // Version-guarded so a note edited during the send round-trip is not stamped
  // back to a stale status: on success "submitted", on failure restore the
  // send-failed state. The claim already cleared lastSendFailed, so a failed
  // send must set it back to true.
  await setDraftStatus(
    db,
    draft.id,
    outcome.sent ? "submitted" : "error",
    !outcome.sent,
    now,
    claim.version
  );
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
