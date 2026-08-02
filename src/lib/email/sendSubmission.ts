import { Resend } from "resend";
import { getEmailConfig } from "./config";

export interface SubmissionMail {
  ticket: string;
  filenameBase: string;
  format: string;
  auditStatus: string;
  submittedByName: string;
  submittedAtEt: string;
  frozenNote: string;
  frozenAudit: string;
}

export type SendOutcome =
  | { attempted: false } // email is not configured on this deployment
  | { attempted: true; sent: boolean };

// One send path, used by the original submit and by a later resend, so a
// resent email is byte-for-byte the message that failed — same frozen note,
// same audit report, same ticket. Recomposing on resend could produce a
// different document under a newer ruleset, which would quietly break the
// promise that a ticket names one fixed record.
//
// Never throws: a send failure is an outcome the caller records, not an
// exception that could unwind work already committed.
export async function sendSubmissionEmail(mail: SubmissionMail): Promise<SendOutcome> {
  const config = getEmailConfig();
  if (!config.configured) return { attempted: false };
  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from as string,
      to: [config.corporateEmail as string],
      subject: `Dental note ${mail.ticket} — ${mail.auditStatus}`,
      text: `De-identified dental note ${mail.ticket} attached, with its audit report. Submitted by ${mail.submittedByName} at ${mail.submittedAtEt}. Complete identifiers only in the EDR.`,
      attachments: [
        {
          filename: `${mail.filenameBase}-${mail.ticket}.${mail.format}`,
          content: Buffer.from(mail.frozenNote, "utf8")
        },
        {
          filename: `${mail.filenameBase}-${mail.ticket}-audit.md`,
          content: Buffer.from(mail.frozenAudit, "utf8")
        }
      ]
    });
    if (error) console.error("submission email failed:", error.name ?? "error");
    return { attempted: true, sent: !error };
  } catch {
    console.error("submission email threw");
    return { attempted: true, sent: false };
  }
}
