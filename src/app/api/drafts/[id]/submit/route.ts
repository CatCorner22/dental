import { requireRole } from "@/lib/auth/guards";
import { canWriteNote } from "@/lib/auth/roles";
import { readJsonRecord } from "@/lib/http/readJson";
import { getDb } from "@/lib/db/client";
import { getDraft, setDraftStatus } from "@/lib/db/repo/drafts";
import { fileSubmissionAtomic } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import { activeModules } from "@/lib/modules";
import { composeNote, composeNoteText } from "@/lib/compose/composeNote";
import { officeNameFor } from "@/lib/db/repo/offices";
import { composeAuditReport } from "@/lib/compose/composeAuditReport";
import {
  computeGates,
  isValidPhiAttestation,
  PHI_ATTESTATION_RULE,
  runAudit,
  visibleText
} from "@/lib/audit/engine";
import { sendSubmissionEmail } from "@/lib/email/sendSubmission";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { slugifyTitle } from "@/lib/tickets/slug";
import { composeStamp } from "@/lib/tickets/stamp";
import { RULESET_VERSION } from "@/lib/version";
import { checkFilingAuthority } from "@/lib/auth/approval";
import { deriveGpa } from "@/lib/gpa/deriveGpa";
import { assistEventsForDraft } from "@/lib/db/repo/auditLog";
import { statRowsForUser } from "@/lib/db/repo/submissions";
import { computeStats } from "@/lib/stats/computeStats";
import { awardForSubmission, awardOnce } from "@/lib/db/repo/gamify";
import { BADGES } from "@/lib/stats/badges";
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
  if (!canWriteNote(guard.user.role, draft.ownerId, guard.user.id)) {
    return Response.json({ error: "You cannot submit this draft." }, { status: 403 });
  }
  // A note that has not changed since its last submission must not file a
  // duplicate ticket. Any edit clears lastSubmissionId via the PATCH recompute.
  // This is keyed on the filing itself, not on the cached status: when the
  // email fails the status becomes "error" so the user sees it, and only this
  // check still stands between them and a second ticket for identical content.
  // The status check is a fallback for any draft the backfill could not
  // reach: if it still reads "submitted", it was filed, whatever the column
  // says. Cheaper to keep both than to file one duplicate ticket.
  if (draft.lastSubmissionId !== null || draft.status === "submitted") {
    return Response.json(
      {
        error: draft.lastSendFailed
          ? "This note is already filed; its email did not go out. Use Resend — submitting again would file a second ticket."
          : "This note is already submitted. Edit it before submitting again.",
        canResend: draft.lastSendFailed
      },
      { status: 409 }
    );
  }

  // An empty body means "all defaults"; a body that parses to anything other
  // than a JSON object (null, a number, an array) is refused loudly — the
  // recipient-key guard below must never throw on a weird body shape.
  const parsed = await readJsonRecord(req);
  if (parsed.kind === "invalid") {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const body: Record<string, unknown> = parsed.kind === "object" ? parsed.value : {};
  // Poka-yoke: the corporate address is server configuration, never client
  // input. A request that even TRIES to steer the recipient is refused loudly
  // (the README promises this), not silently ignored.
  // Case-INSENSITIVE: the lowercase-only list refused {"to":…} loudly but let
  // {"To":…} through with a 200. Nothing downstream reads those keys, so no
  // recipient was ever steerable — but the README promises a loud refusal, and
  // a guarantee that only holds for one letter case is not the guarantee.
  const RECIPIENT_KEYS = new Set(["to", "cc", "bcc", "recipient", "recipients", "email", "address"]);
  for (const key of Object.keys(body)) {
    if (RECIPIENT_KEYS.has(key.toLowerCase())) {
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
  // Normalized at the boundary — the audit log gets the same readable text the
  // frozen record and the validator do, never a string of invisible characters.
  const phiReason =
    phiOverride && typeof (body.phiOverride as { reason?: unknown }).reason === "string"
      ? visibleText((body.phiOverride as { reason: string }).reason).replace(/\s+/g, " ").trim().slice(0, 500)
      : "";

  // Server composes and runs the FULL audit — the client is never trusted.
  const note = draft.noteState;
  const modules = activeModules(note.selectedModuleIds);

  // Approve & Lock: a sedation or robotic record, or a note carrying a
  // dentist's assessment/plan, is FILED by a dentist — the filer's name is
  // what freezes onto the legal record as the licensed approver. The author
  // transfers the draft; the transfer rail keeps their authorship on the
  // record. Checked before any gate so the person hears the real reason, not
  // a downstream symptom.
  const filing = checkFilingAuthority(guard.user.clinicalRole, modules, note);
  if (!filing.allowed) {
    return Response.json(
      { error: filing.message, code: "dentist-filing-required" },
      { status: 403 }
    );
  }
  // Resolved ONCE, here, and frozen below. Reading the office name at file
  // time is what makes it a fact about the encounter rather than a live lookup
  // that a later rename would silently rewrite.
  const officeName = await officeNameFor(db, draft.officeId);
  const markdown = composeNote(note, modules, { officeName });
  const report = runAudit({ note, modules, composedText: markdown });
  // The reason is validated HERE, not just in the dialog. The browser-side
  // minimum was the only check before, so a tampered client could waive every
  // privacy stop with `{confirmed:true}` and no reason, and the note filed
  // with "(no reason given)" in the log. An attestation with no content is
  // not an attestation; the request is refused before any gate opens.
  if (phiOverride && report.phiStops.length > 0 && !isValidPhiAttestation(phiReason)) {
    return Response.json(
      {
        error: `Overriding a privacy stop needs a real attestation. ${PHI_ATTESTATION_RULE}`
      },
      { status: 422 }
    );
  }
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

  // The GPA, derived from the report above and frozen with the filing. Never
  // a gate — the gates already ran; this is the grade on what passed them.
  const grade = deriveGpa(report, note, modules);
  // AI provenance: every assist event recorded against this draft, folded in
  // as identifiers (capability, prompt version, sources). Empty means no AI
  // touched this note's text — which is itself a statement worth freezing.
  const assistEvents = await assistEventsForDraft(db, draft.id, guard.user.id);
  const assistProvenance =
    assistEvents.length > 0
      ? { events: assistEvents, gpaVersion: grade.gpaVersion }
      : { events: [], gpaVersion: grade.gpaVersion };

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
        auditStatus: report.status,
        gpa: grade.gpa.toFixed(2),
        gpaSubscores: grade.subscores as unknown as Record<string, number>,
        assistProvenance,
        officeId: draft.officeId,
        officeName
      },
      // Pin the claim to the exact version whose noteState was composed and
      // audited above — an autosave landing mid-submit must not be frozen out
      // of the record, nor a stale copy frozen into it.
      draft.version,
      now,
      (ticket) => {
        const stamp = composeStamp({
          ticket,
          submittedBy: submittedByName,
          submittedAtEt,
          ruleVersion: RULESET_VERSION,
          auditStatus: report.status,
          officeName
        });
        frozenNote =
          (format === "txt" ? composeNoteText(note, modules, { officeName }) : markdown) +
          "\n" +
          stamp;
        frozenAudit =
          composeAuditReport(
            report,
            modules,
            markdown,
            phiOverride && report.phiStops.length > 0
              ? { stops: report.phiStops.length, reason: phiReason, attestedBy: submittedByName }
              : undefined
          ) +
          "\n" +
          stamp;
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
    // Distinguish "someone else already filed it" from "the note changed
    // while this submit was in flight" so the user gets the right next step.
    const fresh = await getDraft(db, draft.id);
    if (fresh && fresh.status !== "submitted" && fresh.version !== draft.version) {
      return Response.json(
        { error: "The note changed while submitting. Review the latest version, then submit again." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "This note is already submitted. Edit it before submitting again." },
      { status: 409 }
    );
  }
  const ticket = filed.ticket;

  // The economy (best-effort, like the email): the note is FILED; a points
  // hiccup must never look like a filing failure. Idempotency lives in the
  // database (partial unique index on the ledger), so a retry cannot
  // double-pay. Badge bonuses are keyed per badge the same way.
  try {
    const rows = await statRowsForUser(db, guard.user.id);
    const freshStats = computeStats(rows);
    await awardForSubmission(db, {
      userId: guard.user.id,
      submissionId: filed.submissionId,
      gpa: grade.gpa,
      streak: freshStats.currentStreak
    });
    for (const badgeId of freshStats.badges) {
      const bonus = BADGES[badgeId].bonus;
      if (!bonus) continue;
      await awardOnce(db, {
        userId: guard.user.id,
        refType: "badge",
        refId: badgeId,
        points: bonus,
        reason: `badge:${badgeId}`
      });
    }
  } catch {
    // A missing award is a support question; a failed filing is an outage.
  }

  // Email (best-effort): the note is already filed; a send failure marks the
  // draft resendable, it never un-files the ticket.
  const outcome = await sendSubmissionEmail({
    ticket,
    filenameBase,
    format,
    auditStatus: report.status,
    submittedByName,
    submittedAtEt,
    frozenNote,
    frozenAudit
  });
  const config = { configured: outcome.attempted };
  const emailed = outcome.attempted && outcome.sent;

  // Honest cache: a failed email shows the rose "Send failed" chip and offers
  // Resend. The ticket is already filed and lastSubmissionId is set, so the
  // draft is NOT re-fileable — retrying during an outage resends the frozen
  // copy instead of appending a second ticket for the same note.
  const sendFailed = config.configured && !emailed;
  // Version-guarded to filed.version: the email round-trip is slow, and a note
  // edited in another tab during it bumps the version and nulls lastSubmissionId
  // — that edit must win, not be stamped back to "Send failed".
  if (sendFailed) await setDraftStatus(db, draft.id, "error", true, now, filed.version);
  await logAction(db, {
    actorId: guard.user.id,
    actorName: submittedByName,
    action: emailed ? "submit" : config.configured ? "submit.email-failed" : "submit.no-email",
    target: ticket,
    detail: draft.id
  });

  // A PHI override is the one safety gate a person can waive. Record who
  // attested and why, keyed to the ticket, so the legal record shows it.
  // The rule ids name WHAT was waived; the matched text is deliberately NOT
  // copied here — writing the flagged string into the audit log would spread
  // the very content the screen exists to contain into a second table.
  if (phiOverride && report.phiStops.length > 0) {
    const waived = [...new Set(report.phiStops.map((f) => f.ruleId))].join(", ");
    await logAction(db, {
      actorId: guard.user.id,
      actorName: submittedByName,
      action: "submit.phi-override",
      target: ticket,
      detail: `${report.phiStops.length} PHI stop(s) [${waived}] attested: ${phiReason}`
    });
  }

  const firstPass = report.status === FIRST_PASS_STATUS;
  return Response.json({
    ticket,
    submissionId: filed.submissionId,
    emailed,
    // The claim bumped the draft version; the open builder adopts this so its
    // next autosave is not a false 409.
    version: filed.version,
    sparkle: sparkleLine(firstPass ? "firstPass" : "afterSubmit", filed.submissionId)
  });
}
