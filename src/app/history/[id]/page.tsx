import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { getSubmission } from "@/lib/db/repo/submissions";
import { formatTicket } from "@/lib/tickets/ticket";

export const runtime = "nodejs";
export const metadata = { title: "Submission — Dental Note Builder" };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const session = await auth();
  const user = session!.user;
  const db = await getDb();
  const s = Number.isInteger(numId) ? await getSubmission(db, numId) : undefined;
  if (!s) notFound();
  if (user.role === "user" && s.submittedById !== user.id) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">{formatTicket(s.id)}</h1>
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="font-semibold text-slate-600">Submitted by</dt>
        <dd>{s.submittedByName}</dd>
        <dt className="font-semibold text-slate-600">Eastern time</dt>
        <dd>{s.submittedAtEt}</dd>
        <dt className="font-semibold text-slate-600">Audit status</dt>
        <dd>{s.auditStatus}</dd>
        <dt className="font-semibold text-slate-600">Ruleset version</dt>
        <dd>{s.ruleVersion}</dd>
      </dl>
      <p className="mb-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        This is the frozen record exactly as submitted — it never changes, even if the templates or
        rules are later updated. It may form part of a legal and medical record.
      </p>
      <h2 className="mb-2 text-lg font-semibold">Note</h2>
      <pre className="mb-6 overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs">{s.noteMarkdown}</pre>
      <h2 className="mb-2 text-lg font-semibold">Audit report</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs">{s.auditReport}</pre>
    </div>
  );
}
