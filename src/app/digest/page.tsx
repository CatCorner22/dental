import { redirect } from "next/navigation";
import { meetsRole } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { listSubmissionsForDigest } from "@/lib/db/repo/submissions";
import { buildDigest } from "@/lib/digest/digest";
import { deriveNoteType, type FiledNote } from "@/lib/digest/metrics";
import { proposalsFromNotes } from "@/lib/learning/proposals";
import { grammarGrowthFromNotes } from "@/lib/learning/grammarGrowth";
import { UNPARSED_CATEGORY_LABEL } from "@/lib/extract/classifyUnparsed";
import { unknownAbbreviations } from "@/lib/vocab/unknownAbbreviations";
import { HelpTip } from "@/components/ui/HelpTip";
import { listAuditLogByActionPrefix } from "@/lib/db/repo/auditLog";
import { buildByteStarSummary } from "@/lib/bytestar/summary";
import { ByteStarSummaryPanel } from "@/components/digest/ByteStarSummaryPanel";

export const runtime = "nodejs";
export const metadata = { title: "Documentation digest" };

// THE TEAM LEAD DIGEST, as a page.
//
// Gated to Team Lead and above, because it names individuals. Everything on it
// is derived from notes the practice already stores; nothing new is logged to
// produce it.
//
// WHAT THIS PAGE DELIBERATELY IS NOT: a scoreboard. There is no ranking, no
// leaderboard, no per-person score, and no history of who was mentioned last
// month. The digest reports patterns over a period and then stops, because a
// running tally is how a quality tool becomes a performance-management tool,
// and staff who believe they are being scored write the shortest note that
// clears the gates — which is the exact outcome this product exists to prevent.

const PERIOD_DAYS = 30;
/** Hard cap: each row carries full note + audit JSON; unbounded loads OOM isolates. */
const DIGEST_ROW_CAP = 500;

export default async function DigestPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "lead")) redirect("/");

  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const db = await getDb();
  const rows = await listSubmissionsForDigest(db, since, DIGEST_ROW_CAP);
  const digestTruncated = rows.length >= DIGEST_ROW_CAP;

  const notes: FiledNote[] = rows.map((row) => ({
    submissionId: row.id,
    authorId: row.submittedById,
    authorName: row.submittedByName,
    filedAtIso: row.submittedAtEt,
    markdown: row.noteMarkdown,
    auditReportJson: row.auditReport,
    noteType: deriveNoteType(row.noteMarkdown)
  }));

  const digest = buildDigest(notes, since.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
  const practice = digest.signals.filter((s) => s.scope === "practice");
  const people = digest.signals.filter((s) => s.scope === "person");

  // Vocabulary proposals, from the same notes already loaded. No extra query.
  //
  // This section is what makes tier 3 of the filing gate defensible. That tier
  // blocks a note containing shorthand no table can read, and a block with no
  // route out is a dead end — a writer stopped by a word the practice uses
  // forty times a month, and nothing ever changing. This is the route.
  const sightings = notes.map((n) => ({
    text: n.markdown,
    authorId: n.authorId,
    filedAt: n.filedAtIso
  }));
  const proposals = proposalsFromNotes(
    sightings,
    unknownAbbreviations(notes.map((n) => n.markdown))
  );
  const grammarGrowth = grammarGrowthFromNotes(sightings);

  // The pioneer's period report: same window as the rest of the digest,
  // rolled up from the transparent bytestar.* rows. Counts and codes only.
  const byteStarRows = await listAuditLogByActionPrefix(db, "bytestar.", 2000);
  const byteStarSummary = buildByteStarSummary(
    byteStarRows.map((r) => ({ action: r.action, detail: r.detail, atMs: r.at.getTime() })),
    since.getTime()
  );

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <h1 className="page-title">Documentation digest</h1>
        <HelpTip label="About the digest">
          Patterns from the last {PERIOD_DAYS} days of filed notes — never a score or a ranking.
          Vocabulary proposals and grammar-growth categories point at what the tool should learn
          next; nothing changes without a human-ratified change request.
        </HelpTip>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        The last {PERIOD_DAYS} days: {digest.notesReviewed}{" "}
        {digest.notesReviewed === 1 ? "note" : "notes"} from {digest.authorsReviewed}{" "}
        {digest.authorsReviewed === 1 ? "person" : "people"}. Built from notes already on file — nothing
        extra is recorded to produce this.
      </p>
      {digestTruncated ? (
        <p className="mt-2 max-w-3xl text-xs text-amber-900/80">
          Showing the {DIGEST_ROW_CAP} most recent filings in this window. Older notes in the period are
          omitted so the digest stays within a safe memory budget.
        </p>
      ) : null}
      <p className="mt-2 max-w-3xl text-xs text-slate-600">
        Patterns over a period, never a verdict on one note, and never a score. Anything most of the
        practice would be flagged for is reported as a finding about the tool or the template instead,
        because a standard nobody meets is a badly set standard.
      </p>

      {proposals.length > 0 && (
        <section className="mt-6">
          <h2 className="section-title">Words the tool cannot read yet</h2>
          <p className="mb-2 max-w-3xl text-xs text-slate-600">
            Shorthand used by at least two people, in at least five notes, that no vocabulary table
            knows. Each of these currently stops a note being filed until the writer spells it out —
            adding it here makes every future use free. Evidence is shown with everything outside the
            controlled vocabulary removed, so these lines carry no patient detail.
          </p>
          <ul className="space-y-3">
            {proposals.map((p) => (
              <li key={p.id} className="card-inset">
                <p className="font-semibold text-slate-900">
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono">{p.subject}</span>{" "}
                  <span className="font-normal text-slate-700">
                    — {p.evidence.occurrences} uses across {p.evidence.notes} notes by{" "}
                    {p.evidence.authors} people
                  </span>
                </p>
                {p.evidence.contexts.length > 0 && (
                  <ul className="mt-1 space-y-0.5 font-mono text-xs text-slate-600">
                    {p.evidence.contexts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-sm text-slate-700">{p.effect}</p>
                {/* One click carries the evidence into the gauntlet — the
                    five sterilization cycles still run in full. */}
                <a
                  className="btn-secondary mt-2 inline-block text-xs"
                  href={`/requests?summary=${encodeURIComponent(
                    `Add vocabulary entry for "${p.subject}" — ${p.evidence.occurrences} uses across ${p.evidence.notes} notes by ${p.evidence.authors} people (digest evidence).`
                  )}`}
                >
                  Raise a change request for this word
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            Nothing here changes by itself. Raise a{" "}
            <a href="/requests" className="underline">
              change request
            </a>{" "}
            to add one, and it ships with the next ruleset version.
          </p>
        </section>
      )}

      <ByteStarSummaryPanel summary={byteStarSummary} windowDays={PERIOD_DAYS} />

      {grammarGrowth.length > 0 && (
        <section className="mt-6">
          <h2 className="section-title">Phrase shapes the parser cannot read yet</h2>
          <p className="mb-2 max-w-3xl text-xs text-slate-600">
            Unread clauses grouped by category (medication, imaging, procedure, and so on) when at
            least two authors leave the same kind of gap. These are grammar-growth candidates — labels
            are questions for the tables, never invented chart facts.
          </p>
          <ul className="space-y-3">
            {grammarGrowth.map((g) => (
              <li key={g.category} className="card-inset">
                <p className="font-semibold text-slate-900">
                  <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold">
                    {UNPARSED_CATEGORY_LABEL[g.category]}
                  </span>{" "}
                  <span className="font-normal text-slate-700">
                    — {g.occurrences} unread phrases across {g.notes} notes by {g.authors} people
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-slate-600">e.g. “{g.sample}”</p>
                <p className="mt-1 text-sm text-slate-700">{g.effect}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {digest.notesReviewed === 0 ? (
        <p className="mt-6 rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No notes filed in the last {PERIOD_DAYS} days, so there is nothing to review.
        </p>
      ) : digest.allClear ? (
        <div className="card-note mt-6">
          <p className="font-semibold text-brand-navy">Nothing to raise this period.</p>
          <p className="mt-1 text-sm text-slate-700">
            No pattern crossed a reporting threshold across {digest.notesReviewed} notes. That is a
            result, not an absence of one.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {practice.length > 0 && (
            <section>
              <h2 className="section-title">The tool and the templates</h2>
              <p className="mb-2 text-xs text-slate-600">
                Findings that belong to Smile Notes or to a shared template rather than to any one
                person. These are listed first on purpose.
              </p>
              <ul className="space-y-3">
                {practice.map((s) => (
                  <li key={s.id} className="card-inset">
                    <p className="font-semibold text-slate-900">{s.headline}</p>
                    <p className="mt-1 text-sm text-slate-700">{s.detail}</p>
                    <p className="mt-1 text-xs text-slate-500">Based on {s.sample} notes.</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {people.length > 0 && (
            <section>
              <h2 className="section-title">Worth one conversation</h2>
              <p className="mb-2 max-w-3xl text-xs text-slate-600">
                Each of these compares someone against the practice median for the same kind of note,
                over at least ten of their own notes. They are starting points for a conversation, not
                conclusions — the person writing the notes knows things this tool does not.
              </p>
              <ul className="space-y-3">
                {people.map((s) => (
                  <li key={s.id} className="card-inset">
                    <p className="font-semibold text-slate-900">{s.headline}</p>
                    <p className="mt-1 text-sm text-slate-700">{s.detail}</p>
                    <p className="mt-1 text-xs text-slate-500">Based on {s.sample} of their notes.</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
