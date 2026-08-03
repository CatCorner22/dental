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
import { recentGradedForUser, statRowsForUser } from "@/lib/db/repo/submissions";
import { listUsers } from "@/lib/db/repo/users";
import { computeStats, rollingGpa } from "@/lib/stats/computeStats";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { GamifyPanel, type GamifyView } from "@/components/dashboard/GamifyPanel";
import { balanceFor, xpFor } from "@/lib/db/repo/gamify";
import { rankFor } from "@/lib/gamify/ranks";
import { deriveInsights } from "@/lib/gamify/insights";
import { formatTicket } from "@/lib/tickets/ticket";
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

  const statRows = await statRowsForUser(db, user.id);
  const stats = computeStats(statRows);

  // The progression panel's numbers — the viewer's own, nobody else's.
  let gamify: GamifyView | null = null;
  if (meetsRole(user.role, "user")) {
    const [xp, balance, recent] = await Promise.all([
      xpFor(db, user.id),
      balanceFor(db, user.id),
      recentGradedForUser(db, user.id, 10)
    ]);
    // Daily GPA averages over the last 30 days, oldest first, Eastern days.
    const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
    const cutoff = Date.now() - 30 * 86_400_000;
    const byDay = new Map<string, number[]>();
    for (const r of statRows) {
      if (!r.gpa || r.submittedAtUtc.getTime() < cutoff) continue;
      const day = dayFmt.format(r.submittedAtUtc);
      byDay.set(day, [...(byDay.get(day) ?? []), parseFloat(r.gpa)]);
    }
    const trend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, gpas]) => ({
        day,
        gpa: Math.round((gpas.reduce((a, b) => a + b, 0) / gpas.length) * 100) / 100
      }));
    gamify = {
      rankProgress: rankFor(xp),
      xp,
      balance,
      rollingGpa: rollingGpa(statRows),
      trend,
      recent: recent.map((r) => ({
        id: r.id,
        ticket: formatTicket(r.id),
        gpa: r.gpa,
        whenEt: r.submittedAtEt
      })),
      insights: deriveInsights(statRows)
    };
  }

  const wordMapGroups = buildWordMap();
  const counts = wordMapCounts(wordMapGroups);

  return (
    <>
    <Dashboard
      role={user.role}
      displayName={user.displayName}
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
      stats={stats}
      totalDrafts={total}
    />
      {gamify && (
        <section className="mt-6">
          <GamifyPanel view={gamify} />
        </section>
      )}
      {/* The practice's standard wording, on the dashboard where everyone who
          writes a note will see it. Built from the same tables the audit
          enforces, so this reference can never drift from the rule. Read-only
          accounts are excluded — they cannot author a note, so the vocabulary
          is not theirs to apply. */}
      {meetsRole(user.role, "user") && (
        <section className="mt-10">
          <h2 className="mb-1 text-xl font-bold">Word map</h2>
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
