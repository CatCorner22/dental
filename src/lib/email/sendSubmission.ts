import { Resend } from "resend";
import { getEmailConfig } from "./config";
import { submissionSubject, threadHeaders } from "./threading";

export interface SubmissionMail {
  ticket: string;
  filenameBase: string;
  format: string;
  auditStatus: string;
  submittedByName: string;
  submittedAtEt: string;
  frozenNote: string;
  frozenAudit: string;
  /** 0 for the original send, incrementing for each resend. Drives the
   *  threading headers so a resend joins the original conversation instead of
   *  starting a second one about the same ticket. */
  attempt?: number;
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
      // Every message about one ticket lands in one conversation: the ticket in
      // the subject for clients that thread on subject, and RFC 5322
      // References/In-Reply-To for the ones that do it properly. The token
      // carries no patient data — see threading.ts for why it must not.
      headers: threadHeaders(mail.ticket, mail.attempt ?? 0, config.from),
      subject: submissionSubject(mail.ticket, mail.auditStatus),
      text: `De-identified Smile Note ${mail.ticket} attached, with its audit report. Submitted by ${mail.submittedByName} at ${mail.submittedAtEt}. Complete identifiers only in the EDR.`,
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
