import { createHash, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { getEmailConfig } from "@/lib/email/config";
import { validateSendRequest } from "@/lib/email/validateSendRequest";
import { computeGates, runAudit } from "@/lib/audit/engine";
import { activeModules } from "@/lib/modules";
import { composeNote, composeNoteText } from "@/lib/compose/composeNote";

export const runtime = "nodejs";

// Capability probe. The client hides the email action when unconfigured.
export async function GET(): Promise<Response> {
  const config = getEmailConfig();
  return Response.json({
    emailConfigured: config.configured,
    accessCodeRequired: config.accessCodeRequired
  });
}

function codeMatches(expected: string, provided: string): boolean {
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(provided).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const config = getEmailConfig();
  if (!config.configured) {
    return Response.json(
      { error: "Email is not configured. Download the note instead." },
      { status: 503 }
    );
  }

  if (config.accessCodeRequired) {
    const provided = req.headers.get("x-access-code") ?? "";
    if (!provided || !codeMatches(config.accessCode as string, provided)) {
      return Response.json({ error: "The access code is missing or wrong." }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "The request body must be JSON." }, { status: 400 });
  }
  const result = validateSendRequest(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  const { filename, format, note, phiOverride } = result.value;

  // The server composes the note and runs the FULL audit — every rule the
  // client runs, including the state-only anatomy and required-field rules.
  // The attachment is the server's own composition, so a tampered client
  // cannot smuggle text past the gate or send a note it did not audit.
  let markdown: string;
  let content: string;
  let gates: ReturnType<typeof computeGates>;
  let blocking: { ruleId: string; severity: string; message: string }[];
  try {
    const modules = activeModules(note.selectedModuleIds);
    markdown = composeNote(note, modules);
    content = format === "md" ? markdown : composeNoteText(note, modules);
    const report = runAudit({ note, modules, composedText: markdown });
    gates = computeGates(report, phiOverride?.confirmed === true);
    blocking = report.findings
      .filter((f) => f.severity === "S0" || f.severity === "S1")
      .map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message }));
  } catch {
    return Response.json({ error: "The note could not be composed." }, { status: 400 });
  }

  if (!gates.emailAllowed) {
    return Response.json(
      {
        error: "The audit found open STOP or REQUIRED findings. Resolve them, then send again.",
        findings: blocking
      },
      { status: 422 }
    );
  }

  const resend = new Resend(config.apiKey);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const { error } = await resend.emails.send({
    from: config.from as string,
    to: [config.corporateEmail as string], // fixed recipient — never from the request
    subject: `Standardized dental note draft — ${stamp}`,
    text: "De-identified dental note draft attached. Complete identifiers, exact dates, and signatures only in the EDR.",
    attachments: [
      {
        filename: `${filename}.${format}`,
        content: Buffer.from(content, "utf8")
      }
    ]
  });

  if (error) {
    // Log status only. Never log note content.
    console.error("send-note failed:", error.name ?? "error");
    return Response.json(
      { error: "The email service rejected the message. Download the note instead." },
      { status: 502 }
    );
  }
  return Response.json({ sent: true });
}
