import { redirect } from "next/navigation";
import { meetsRole, seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import {
  countAllDrafts,
  listAllDrafts,
  listDraftsByOwner,
  ownerDraftCount
} from "@/lib/db/repo/drafts";
import { listUsers } from "@/lib/db/repo/users";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { DraftStatus } from "@/lib/status/draftStatus";
import { WordMap } from "@/components/standardize/WordMap";
import { buildWordMap, wordMapCounts } from "@/lib/standardize/wordMap";

export const runtime = "nodejs";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  // The list is capped at one page. The count comes back too so the view can
  // say so out loud — a silently truncated list reads as "this is everything",
  // which is exactly how someone loses track of a note.
  const mine = !seesAllNotes(user.role);
  const rows = mine ? await listDraftsByOwner(db, user.id) : await listAllDrafts(db);
  const total = mine ? await ownerDraftCount(db, user.id) : await countAllDrafts(db);

  // Owner display names for the admin/readonly "all drafts" view — one query.
  const ownerNames: Record<string, string> = {};
  if (user.role !== "user") {
    for (const u of await listUsers(db)) ownerNames[u.id] = u.displayName;
  }

  const wordMapGroups = buildWordMap();
  const counts = wordMapCounts(wordMapGroups);

  return (
    <>
      <Dashboard
        role={user.role}
        clinicalRole={user.clinicalRole}
        displayName={user.displayName}
        username={user.username}
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
      {/* The practice's standard wording, below the draft list — never between
          "start a note" and the work. Built from the same tables the audit
          enforces, so this reference can never drift from the rule. Read-only
          accounts are excluded — they cannot author a note, so the vocabulary
          is not theirs to apply. */}
      {meetsRole(user.role, "user") && (
        <section className="mt-10">
          <h2 className="section-title mb-1">Word map</h2>
          <p className="mb-3 max-w-3xl text-sm text-slate-600">
            The wording this practice standardizes on. Anything marked{" "}
            <span className="rounded bg-amber-100 px-1 text-xs text-amber-900">your call</span>{" "}
            needs a clinical judgement, so the tool flags it instead of changing it.
          </p>
          <WordMap groups={wordMapGroups} total={counts.total} auto={counts.auto} />
        </section>
      )}
    </>
  );
}
