import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { canSendResetLink, ROLE_LABEL } from "@/lib/auth/roles";
import { issueResetLink } from "@/lib/auth/issueResetLink";
import { checkThrottle, recordFailure, resetLinkKey } from "@/lib/auth/throttle";

export const runtime = "nodejs";

// A link goes astray or a colleague deletes it — a few retries is normal.
const RESET_LINK_FREE_ATTEMPTS = 3;

type Ctx = { params: Promise<{ id: string }> };

// Send a password-reset LINK to an account holder.
//
// This is how a Team Lead or Hierarchy Manager restores someone's access
// without ever seeing or choosing a credential. The response never contains the
// token — only a confirmation that mail went out — so the actor holds nothing
// that would let them enter the account themselves.
export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });

  // Authority is measured against the target's role: a Team Lead may reset a
  // team member but must not be able to seize a Hierarchy Manager's or a
  // Developer's account by mailing themselves a link.
  // A deactivated account cannot sign in anyway, so a link would be a dead end
  // mailed to a possibly-former employee — and if the account were reactivated
  // within the hour, a stale link would still work.
  if (!target.active) {
    return Response.json(
      { error: "That account is deactivated. Reactivate it before sending a reset link." },
      { status: 409 }
    );
  }
  if (!canSendResetLink(guard.user.role, target.role)) {
    return Response.json(
      { error: `You cannot send a reset link to a ${ROLE_LABEL[target.role]} account.` },
      { status: 403 }
    );
  }

  // SEPARATION OF DUTIES — the control that makes "nobody can see your
  // password" true rather than merely stated.
  //
  // Changing an address and then mailing a link to it is a complete account
  // takeover in two requests: the actor becomes that person and can sign Smile
  // Notes in their name. Both halves are legitimate on their own, so neither
  // can simply be forbidden. What is forbidden is doing BOTH — the person who
  // moved the address is not the person who may send a link to it. Another
  // Hierarchy Manager or a Smile Notes Developer can, which keeps a real
  // recovery path open while requiring two people to be involved.
  if (
    guard.user.role !== "admin" &&
    target.emailChangedBy &&
    target.emailChangedBy === guard.user.id
  ) {
    return Response.json(
      {
        error:
          "You changed the email on this account, so you cannot also send its reset link. " +
          "Ask another Hierarchy Manager or a Smile Notes Developer to send it."
      },
      { status: 403 }
    );
  }

  const now = new Date();

  // Metered per TARGET. Issuing a link retires the previous one, so a loop is
  // both a mail bomb aimed at a colleague and a way to break a reset they are
  // halfway through completing.
  const meter = await checkThrottle(db, resetLinkKey(target.id), now);
  if (meter.locked) {
    return Response.json(
      {
        error: `A reset link for this account was just sent. Try again in ${meter.retryAfterSec} seconds.`
      },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }
  await recordFailure(db, resetLinkKey(target.id), now, RESET_LINK_FREE_ATTEMPTS);

  const result = await issueResetLink(db, target, guard.user.id, now, "reset");

  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: result.ok ? "user.reset-link-sent" : "user.reset-link-failed",
    target: target.username,
    detail: result.ok ? "emailed" : result.reason
  });

  if (!result.ok) {
    const message =
      result.reason === "no-email"
        ? "This account has no email address on file. Add one first."
        : result.reason === "not-configured"
          ? "Email is not configured on this deployment, so a link cannot be sent."
          : result.reason === "no-base-url"
            ? "APP_URL is not set on this deployment, so the link in the email would not work. Ask a Smile Notes Developer to configure it."
            : "The email could not be sent. Try again shortly.";
    return Response.json({ error: message }, { status: result.reason === "no-email" ? 409 : 502 });
  }
  return Response.json({ ok: true, sentTo: target.email });
}
