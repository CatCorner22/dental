import Link from "next/link";
import { statusLabel } from "@/lib/audit/types";
import { redirect } from "next/navigation";
import { seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import {
  countAllDrafts,
  listAllDrafts,
  listDraftsByOwner,
  ownerDraftCount
} from "@/lib/db/repo/drafts";
import {
  countAllSubmissions,
  listAllSubmissions,
  listSubmissionsByUser,
  submissionCountByUser
} from "@/lib/db/repo/submissions";
import { listUsers } from "@/lib/db/repo/users";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { formatTicket } from "@/lib/tickets/ticket";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import { DraftList } from "@/components/notes/DraftList";
import { HistoryTable } from "@/components/history/HistoryTable";
import { ExportButton } from "@/components/export/ExportButton";
import { HelpTip } from "@/components/ui/HelpTip";
import { Character } from "@/components/mascot/Sparkle";
import type { DraftStatus } from "@/lib/status/draftStatus";

export const runtime = "nodejs";
export const metadata = { title: "My notes" };

// MY NOTES — everything already written, in one place.
//
// Drafts and filed submissions used to live on two separate top-level
// destinations, which meant "where is that note" had two answers depending on
// whether it had been filed. They are two states of the same thing, so they are
// two tabs of the same page.
//
// The tabs are LINKS, not client state: each side needs a different database
// query, and paying for both on every visit to render one of them is worse than
// a navigation. It also means the tab you are on is in the URL and can be
// bookmarked, shared, and reloaded.

export default async function NotesPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const { tab } = await searchParams;
  const filed = tab === "filed";
  const db = await getDb();
  const mine = !seesAllNotes(user.role);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h1 className="page-title">My notes</h1>
          <HelpTip label="About my notes">
            Drafts are still being written and can be edited or deleted. Filed notes are frozen:
            the text, audit report, and ruleset version are stamped at submission and never
            rewritten, so a later rules change cannot alter how a past note reads or was judged.
          </HelpTip>
        </div>
        {filed && <ExportButton table="submissions" />}
      </div>

      <div className="mb-4 flex gap-1.5" role="tablist" aria-label="Note state">
        <Tab href="/notes" label="Drafts" active={!filed} />
        <Tab href="/notes?tab=filed" label="Filed" active={filed} />
      </div>

      {filed ? await FiledTab({ db, mine, userId: user.id }) : await DraftsTab({ db, mine, user })}
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`tap rounded-full px-3.5 py-1 text-sm font-semibold transition-colors duration-100 ${
        active
          ? "bg-brand-navy text-white shadow-sm"
          : "text-slate-700 hover:bg-brand-navy/10 hover:text-brand-navy"
      }`}
    >
      {label}
    </Link>
  );
}

type Db = Awaited<ReturnType<typeof getDb>>;

async function DraftsTab({
  db,
  mine,
  user
}: {
  db: Db;
  mine: boolean;
  user: NonNullable<Awaited<ReturnType<typeof freshSessionUser>>>;
}) {
  // The list is capped at one page. The count comes back too so the view can
  // say so out loud — a silently truncated list reads as "this is everything",
  // which is exactly how someone loses track of a note.
  const rows = mine ? await listDraftsByOwner(db, user.id) : await listAllDrafts(db);
  const total = mine ? await ownerDraftCount(db, user.id) : await countAllDrafts(db);

  // Owner display names for the admin/readonly "all drafts" view — one query.
  const ownerNames: Record<string, string> = {};
  if (user.role !== "user") {
    for (const u of await listUsers(db)) ownerNames[u.id] = u.displayName;
  }

  return (
    <DraftList
      role={user.role}
      canEdit={user.role !== "readonly"}
      drafts={rows.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status as DraftStatus,
        ownerName: ownerNames[d.ownerId],
        mine: d.ownerId === user.id,
        // Pre-formatted on the server (Eastern time, like every other
        // timestamp in the app) so SSR and hydration render identical text —
        // toLocaleString() in the client would use the SERVER's zone during
        // SSR and the browser's after, a hydration mismatch on every row.
        updatedAtLabel: formatEasternTime(d.updatedAt),
        moduleIds: d.moduleIds
      }))}
      totalDrafts={total}
    />
  );
}

async function FiledTab({ db, mine, userId }: { db: Db; mine: boolean; userId: string }) {
  const rows = mine ? await listSubmissionsByUser(db, userId) : await listAllSubmissions(db);
  // Bounded to one page; the total is fetched so the truncation is stated
  // rather than implied.
  const total = mine ? await submissionCountByUser(db, userId) : await countAllSubmissions(db);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-slate-300 bg-white p-6 text-center">
        <Character id="sparkle" size="md" />
        <p className="text-sm text-slate-500">{sparkleLine("history", daySeed(new Date()))}</p>
      </div>
    );
  }

  return (
    <>
      {total > rows.length && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Showing the {rows.length} most recent of {total} submissions.
        </p>
      )}
      <HistoryTable
        rows={rows.map((s) => ({
          id: s.id,
          ticket: formatTicket(s.id),
          label: s.filename,
          by: s.submittedByName,
          office: s.officeName ?? "",
          at: s.submittedAtEt,
          status: statusLabel(s.auditStatus),
          rules: s.ruleVersion
        }))}
      />
    </>
  );
}
