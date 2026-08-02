import { Resend } from "resend";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { canSubmitChangeRequest } from "@/lib/auth/roles";
import { getEmailConfig } from "@/lib/email/config";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { sanitizeMultiline } from "@/lib/text/sanitizeMultiline";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";
import {
  CHECKLIST,
  CYCLES,
  DOWNSTREAM_MODULES,
  evaluateGauntlet,
  type ChecklistId,
  type CycleId,
  type GauntletAnswers
} from "@/lib/requests/gauntlet";
import { composeTicket } from "@/lib/requests/composeTicket";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";

export const runtime = "nodejs";

const MAX_ANSWER = 4000;
const CHANGE_TYPES = ["add", "modify", "remove", "dependency"];

// One ticket per requester per window: submitting mails a real person, and a
// stuck-finger double submit should cost one email, not five.
const REQUEST_FREE_ATTEMPTS = 5;

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canSubmitChangeRequest(guard.user.role)) {
    return Response.json({ error: "You cannot submit change requests." }, { status: 403 });
  }

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;

  // Normalize untrusted input into the exact shape the gauntlet expects. Text
  // is sanitized and length-capped here, before it can reach an email body.
  // Over-length is REFUSED, not truncated. Truncating meant the server judged a
  // different string than the browser did — and cutting the tail could delete
  // the contaminated phrase that the client had correctly flagged, making the
  // server strictly more permissive than the gate the user saw.
  let tooLong = false;
  const str = (v: unknown) => {
    if (typeof v !== "string") return "";
    if (v.length > MAX_ANSWER) tooLong = true;
    return sanitizeMultiline(v, MAX_ANSWER);
  };
  const rawAnswers = (b.answers ?? {}) as Record<string, unknown>;
  const rawChecklist = (b.checklist ?? {}) as Record<string, unknown>;
  const input: GauntletAnswers = {
    // Collapsed to ONE line: these render as header fields in the ticket, so a
    // newline here would forge a line indistinguishable from "Requested by:".
    summary: typeof b.summary === "string" ? sanitizeIdentity(b.summary).slice(0, 200) : "",
    changeType: CHANGE_TYPES.includes(String(b.changeType)) ? String(b.changeType) : "",
    answers: Object.fromEntries(
      CYCLES.map((c) => [c.id, str(rawAnswers[c.id])])
    ) as Record<CycleId, string>,
    checklist: Object.fromEntries(
      CHECKLIST.map((c) => [c.id, rawChecklist[c.id] === true])
    ) as Record<ChecklistId, boolean>,
    dataOwner: typeof b.dataOwner === "string" ? sanitizeIdentity(b.dataOwner).slice(0, 120) : "",
    downstream: Array.isArray(b.downstream)
      ? b.downstream
          .filter((m): m is string => typeof m === "string")
          .filter((m) => (DOWNSTREAM_MODULES as readonly string[]).includes(m))
      : []
  };

  if (tooLong) {
    return Response.json(
      { error: `Each answer must be under ${MAX_ANSWER} characters. Shorten it and try again.` },
      { status: 422 }
    );
  }

  const db = await getDb();
  const now = new Date();
  // Metered BEFORE any expensive work, per throttle.ts's own contract: a gate
  // that runs after the analysis lets an attacker spend server CPU for free by
  // looping requests that never reach the meter.
  const key = `changereq:${guard.user.id}`;
  const throttled = await checkThrottle(db, key, now);
  if (throttled.locked) {
    return Response.json(
      { error: `Too many requests just now. Try again in ${throttled.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(throttled.retryAfterSec) } }
    );
  }

  // The gate is re-run HERE, on the server, against the same pure function the
  // browser used. The client's opinion that a request is sterile is never
  // trusted — otherwise the whole gauntlet could be skipped with one curl.
  const verdict = evaluateGauntlet(input);
  if (!verdict.sterile) {
    return Response.json(
      {
        error: "This request is still contaminated. Clear every cycle before sending it.",
        cycles: verdict.cycles.filter((c) => !c.sterile),
        general: verdict.general
      },
      { status: 422 }
    );
  }

  await recordFailure(db, key, now, REQUEST_FREE_ATTEMPTS);

  const requestedBy = `${guard.user.displayName} (${guard.user.username})`;
  const ticket = composeTicket(input, { requestedBy, requestedAtEt: formatEasternTime(now) });

  // Requests are emailed only — there is no queue to fall back on. So the audit
  // log records that the ask happened regardless of delivery, and a failed send
  // returns the composed ticket so nothing the person wrote is lost.
  await logAction(db, {
    actorId: guard.user.id,
    actorName: requestedBy,
    action: "change-request.submitted",
    target: input.changeType,
    detail: input.summary
  });

  const config = getEmailConfig();
  if (!config.configured) {
    return Response.json(
      {
        error:
          "Email is not configured on this deployment, so the request could not be sent. Copy the text below to the Smile Notes Team.",
        ticket
      },
      { status: 503 }
    );
  }

  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from as string,
      to: [config.corporateEmail as string],
      subject: `Smile Notes data change request — ${input.summary.slice(0, 80)}`,
      text: ticket
    });
    if (error) {
      console.error("change request email failed:", error.name ?? "error");
      await logAction(db, {
        actorId: guard.user.id,
        actorName: requestedBy,
        action: "change-request.send-failed",
        target: input.changeType,
        detail: input.summary
      });
      return Response.json(
        {
          error:
            "The request could not be emailed. Nothing you wrote is lost — copy the text below and send it to the Smile Notes Team.",
          ticket
        },
        { status: 502 }
      );
    }
  } catch {
    console.error("change request email threw");
    return Response.json(
      {
        error:
          "The request could not be emailed. Nothing you wrote is lost — copy the text below and send it to the Smile Notes Team.",
        ticket
      },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, ticket });
}
