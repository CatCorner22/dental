import { notFound, redirect } from "next/navigation";
import { seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { getSubmission } from "@/lib/db/repo/submissions";
import { formatTicket } from "@/lib/tickets/ticket";
import { parseRowId } from "@/lib/db/int4";
import { SubmissionActions } from "@/components/history/SubmissionActions";

export const runtime = "nodejs";
export const metadata = { title: "Submission" };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Range-checked, not just "is it a whole number": an id past int4 would
  // reach the driver and throw instead of rendering a clean 404.
  const numId = parseRowId(id);
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  const s = numId === null ? undefined : await getSubmission(db, numId);
  if (!s) notFound();
  if (!seesAllNotes(user.role) && s.submittedById !== user.id) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-1">{formatTicket(s.id)}</h1>
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
      <SubmissionActions
        ticket={formatTicket(s.id)}
        note={s.noteMarkdown ?? ""}
        audit={s.auditReport ?? ""}
        submittedByName={s.submittedByName}
        submittedAtEt={s.submittedAtEt}
        ruleVersion={s.ruleVersion}
        auditStatus={s.auditStatus}
      />
      <h2 className="mb-2 text-lg font-semibold">Note</h2>
      <pre className="mb-6 overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs">{s.noteMarkdown}</pre>
      <h2 className="mb-2 text-lg font-semibold">Audit report</h2>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs">{s.auditReport}</pre>
    </div>
  );
}
