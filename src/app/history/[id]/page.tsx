import { notFound, redirect } from "next/navigation";
import { statusLabel } from "@/lib/audit/types";
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
        <dd>{statusLabel(s.auditStatus)}</dd>
        <dt className="font-semibold text-slate-600">Ruleset version</dt>
        <dd>{s.ruleVersion}</dd>
      </dl>
      <p className="mb-4 rounded border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 text-xs text-brand-navy">
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
      {/* text-sm on a real .card, not text-xs in a grey slab.
          The frozen note is the entire point of this page and it was the
          SMALLEST text on it — 12px, below the "Submitted by" metadata above it
          and level with its own caption — while the print rule in globals.css
          deliberately lifts this same content to 11pt on paper. Someone reading
          a filed record in a bright operatory is reading tooth numbers, doses in
          mg and probing depths.

          .card rather than .card-inset for both: card-inset is bg-brand-cream/70
          and the page ground is bg-brand-cream, so an un-nested one here would be
          the same colour as the page. The navy .section-title headings are what
          tells the two blocks apart, which is the job headings should be doing. */}
      <h2 className="section-title mb-2">Note</h2>
      <pre className="card mb-6 overflow-x-auto whitespace-pre-wrap break-words text-sm">{s.noteMarkdown}</pre>
      <h2 className="section-title mb-2">Audit report</h2>
      <pre className="card overflow-x-auto whitespace-pre-wrap break-words text-sm">{s.auditReport}</pre>
    </div>
  );
}
