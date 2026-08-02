import { Resend } from "resend";
import type { Db } from "@/lib/db/client";
import type { UserRow } from "@/lib/db/schema";
import { getEmailConfig } from "@/lib/email/config";
import { insertResetToken, invalidateUserResetTokens, pruneResetTokens } from "@/lib/db/repo/resetTokens";
import { generateResetToken, hashResetToken, resetLinkUrl, resetTokenExpiry } from "./resetToken";
import { resetDestination } from "./emails";

export type IssueResetResult =
  | { ok: true }
  | { ok: false; reason: "no-email" | "not-configured" | "no-base-url" | "send-failed" };

// Mint a single-use reset link and email it to the account holder.
//
// The raw token is returned to NOBODY — not to the caller, not in the response,
// not in the audit log. That is the whole point: a Team Lead or Hierarchy
// Manager can restore someone's access without ever holding a credential for
// their account. Only the person reading that mailbox can complete the reset.
export async function issueResetLink(
  db: Db,
  target: UserRow,
  actorId: string | null,
  now: Date,
  purpose: "reset" | "welcome" = "reset"
): Promise<IssueResetResult> {
  const to = resetDestination({ email: target.email, groupEmail: target.groupEmail });
  if (!to) return { ok: false, reason: "no-email" };

  // A reset goes to the person's own address, so it needs sending credentials
  // but NOT the corporate recipient that submissions use — gating on
  // config.configured would block resets on a deployment that simply has no
  // CORPORATE_EMAIL.
  const config = getEmailConfig();
  if (!config.apiKey || !config.from) return { ok: false, reason: "not-configured" };

  const token = generateResetToken();
  // Refuse BEFORE writing a token if the link would be unusable, so a
  // misconfigured deployment reports the problem instead of mailing a dead
  // link and recording it as a success.
  const link = resetLinkUrl(token);
  if (!link) return { ok: false, reason: "no-base-url" };
  // Any outstanding link is retired first, so only the newest one works.
  await invalidateUserResetTokens(db, target.id, now);
  await insertResetToken(db, {
    id: crypto.randomUUID(),
    userId: target.id,
    tokenHash: hashResetToken(token),
    expiresAt: resetTokenExpiry(now),
    createdById: actorId
  });
  await pruneResetTokens(db, now);

  const heading =
    purpose === "welcome"
      ? "Your Smile Notes account is ready"
      : "Set a new Smile Notes password";
  const body =
    purpose === "welcome"
      ? `An account has been created for you in Smile Notes (username: ${target.username}).\n\nChoose your password here — the link works once and expires in an hour:\n\n${link}\n\nIf you were not expecting this, tell your practice manager. Nobody at the practice can see or set your password.`
      : `A password reset was requested for your Smile Notes account (username: ${target.username}).\n\nSet a new password here — the link works once and expires in an hour:\n\n${link}\n\nIf you did not expect this, you can ignore this email; your current password still works. Nobody at the practice can see or set your password.`;

  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from as string,
      to: [to],
      subject: heading,
      text: body
    });
    if (error) {
      console.error("reset link email failed:", error.name ?? "error");
      return { ok: false, reason: "send-failed" };
    }
    return { ok: true };
  } catch {
    console.error("reset link email threw");
    return { ok: false, reason: "send-failed" };
  }
}
