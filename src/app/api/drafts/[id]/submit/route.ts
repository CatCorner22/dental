import { Resend } from "resend";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getDraft, setDraftStatus } from "@/lib/db/repo/drafts";
import { fileSubmissionAtomic } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import { activeModules } from "@/lib/modules";
import { composeNote, composeNoteText } from "@/lib/compose/composeNote";
import { composeAuditReport } from "@/lib/compose/composeAuditReport";
import { computeGates, runAudit } from "@/lib/audit/engine";
import { getEmailConfig } from "@/lib/email/config";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { slugifyTitle } from "@/lib/tickets/slug";
import { composeStamp } from "@/lib/tickets/stamp";
import { RULESET_VERSION } from "@/lib/version";
import { FIRST_PASS_STATUS } from "@/lib/stats/computeStats";
import { sparkleLine } from "@/lib/stats/sparkle";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  if (guard.user.role !== "admin" && draft.ownerId !== guard.user.id) {
    return Response.json({ error: "You cannot submit this draft." }, { status: 403 });
  }
  // A note that has not changed since its last submission must not file a
  // duplicate ticket. Any edit flips the status back via the PATCH recompute.
  if (draft.status === "submitted") {
    return Response.json(
      { error: "This note is already submitted. Edit it before submitting again." },
      { status: 409 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* format defaults below */
  }
  // Poka-yoke: the corporate address is server configuration, never client
  // input. A request that even TRIES to steer the recipient is refused loudly
  // (the README promises this), not silently ignored.
  for (const key of ["to", "cc", "bcc", "recipient", "recipients", "email", "address"]) {
    if (key in body) {
      return Response.json(
        { error: "This endpoint never accepts a recipient. The corporate address is fixed on the server." },
        { status: 400 }
      );
    }
  }

  const format = body.format === "txt" ? "txt" : "md";
  const phiOverride =
    body.phiOverride &&
    typeof body.phiOverride === "object" &&
    (body.phiOverride as { confirmed?: unknown }).confirmed === true
      ? true
      : false;

  // Server composes and runs the FULL audit — the client is never trusted.
  const note = draft.noteState;
  const modules = activeModules(note.selectedModuleIds);
  const markdown = composeNote(note, modules);
  const report = runAudit({ note, modules, composedText: markdown });
  const gates = computeGates(report, phiOverride);
  if (!gates.emailAllowed) {
    return Response.json(
      {
        error: "The audit found open STOP or REQUIRED findings. Resolve them, then submit again.",
        findings: report.findings
          .filter((f) => f.severity === "S0" || f.severity === "S1")
          .map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message }))
      },
      { status: 422 }
    );
  }

  const now = new Date();
  const submittedByName = `${guard.user.displayName} (${guard.user.username})`;
  const submittedAtEt = formatEasternTime(now);
  const filenameBase = slugifyTitle(draft.title);

  // File atomically: claim, reserve the ticket, and freeze the immutable
  // copies in ONE transaction. Of any concurrent submits, exactly one wins;
  // a mid-way failure rolls the whole thing back so the draft stays
  // resubmittable and no blank ticket is ever written to the record. The
  // frozen text is captured here so the email reuses it without recomposing.
  let frozenNote = "";
  let frozenAudit = "";
  let filed;
  try {
    filed = await fileSubmissionAtomic(
      db,
      {
        draftId: draft.id,
        submittedById: guard.user.id,
        submittedByName,
        submittedAtEt,
        filename: filenameBase,
        format,
        ruleVersion: RULESET_VERSION,
        auditStatus: report.status
      },
      now,
      (ticket) => {
        const stamp = composeStamp({
          ticket,
          submittedBy: submittedByName,
          submittedAtEt,
          ruleVersion: RULESET_VERSION,
          auditStatus: report.status
        });
        frozenNote = (format === "txt" ? composeNoteText(note, modules) : markdown) + "\n" + stamp;
        frozenAudit = composeAuditReport(report, modules, markdown) + "\n" + stamp;
        return { note: frozenNote, audit: frozenAudit };
      }
    );
  } catch (e) {
    console.error("submit filing failed:", e instanceof Error ? e.name : "error");
    return Response.json(
      { error: "Could not file the note. Nothing was sent — try again." },
      { status: 500 }
    );
  }
  if (!filed.filed) {
    return Response.json(
      { error: "This note is already submitted. Edit it before submitting again." },
      { status: 409 }
    );
  }
  const ticket = filed.ticket;

  // Email (best-effort): the note is already filed; a send failure only marks
  // the draft resubmittable, it never un-files the ticket.
  const config = getEmailConfig();
  let emailed = false;
  if (config.configured) {
    try {
      const resend = new Resend(config.apiKey);
      const { error } = await resend.emails.send({
        from: config.from as string,
        to: [config.corporateEmail as string],
        subject: `Dental note ${ticket} — ${report.status}`,
        text: `De-identified dental note ${ticket} attached, with its audit report. Submitted by ${submittedByName} at ${submittedAtEt}. Complete identifiers only in the EDR.`,
        attachments: [
          { filename: `${filenameBase}-${ticket}.${format}`, content: Buffer.from(frozenNote, "utf8") },
          { filename: `${filenameBase}-${ticket}-audit.md`, content: Buffer.from(frozenAudit, "utf8") }
        ]
      });
      emailed = !error;
      if (error) console.error("submit email failed:", error.name ?? "error");
    } catch {
      console.error("submit email threw");
    }
  }

  // Honest cache: a failed email shows the rose "Send failed" chip and stays
  // resubmittable; the atomic filing already marked a clean filing "submitted".
  const sendFailed = config.configured && !emailed;
  if (sendFailed) await setDraftStatus(db, draft.id, "error", true, now);
  await logAction(db, {
    actorId: guard.user.id,
    action: emailed ? "submit" : config.configured ? "submit.email-failed" : "submit.no-email",
    target: ticket,
    detail: draft.id
  });

  // A PHI override is the one safety gate a person can waive. Record who
  // attested and why, keyed to the ticket, so the legal record shows it.
  if (phiOverride) {
    const reason =
      typeof (body.phiOverride as { reason?: unknown }).reason === "string"
        ? ((body.phiOverride as { reason: string }).reason).slice(0, 500)
        : "(no reason given)";
    await logAction(db, {
      actorId: guard.user.id,
      action: "submit.phi-override",
      target: ticket,
      detail: `${report.phiStops.length} PHI stop(s) attested: ${reason}`
    });
  }

  const firstPass = report.status === FIRST_PASS_STATUS;
  return Response.json({
    ticket,
    submissionId: filed.submissionId,
    emailed,
    sparkle: sparkleLine(firstPass ? "firstPass" : "afterSubmit", filed.submissionId)
  });
}
