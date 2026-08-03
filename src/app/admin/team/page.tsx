import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { canManageUsers } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listUsers } from "@/lib/db/repo/users";
import { statRowsForUser } from "@/lib/db/repo/submissions";
import { listRedemptions, seedStoreIfEmpty } from "@/lib/db/repo/gamify";
import { STARTER_STORE } from "@/lib/gamify/economy";
import { computeStats } from "@/lib/stats/computeStats";
import { computeStats, rollingGpa } from "@/lib/stats/computeStats";
import { deriveLeadCoachingTip } from "@/lib/gamify/insights";
import { TeamDashboard, type TeamView } from "@/components/admin/TeamDashboard";

export const runtime = "nodejs";
export const metadata = { title: "Team health" };

// The Team Lead dashboard: practice-wide documentation health and store
// fulfillment. No named coaching bands, no GPA grades, no thriving/support
// labels — those read as a ranking even when scores stay hidden, and they
// start fights. Ops aggregates and fulfillment requests are what a lead can
// act on without grading people.

export default async function TeamPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!canManageUsers(user.role)) redirect("/");
  const db = await getDb();
  await seedStoreIfEmpty(db, STARTER_STORE);

  const users = (await listUsers(db)).filter((u) => u.active && u.role !== "readonly");

  let pendingAfterHours = 0;
  const timeToFile: number[] = [];
  let justified = 0;
  let justifiable = 0;

  for (const u of users) {
    const rows = await statRowsForUser(db, u.id);
    const stats = computeStats(rows);
    if (stats.medianMinutesToFile !== null) timeToFile.push(stats.medianMinutesToFile);
    pendingAfterHours += stats.afterHoursCount;
    for (const r of rows) {
      const j = r.gpaSubscores?.justification;
      if (j !== undefined) {
        justifiable++;
        if (j === 1) justified++;
      }
    }
    // Fewer than three graded notes in the window is not a band, it is noise.
    const graded30 = rows.filter(
      (r) => r.gpa && r.submittedAtUtc.getTime() >= Date.now() - 30 * 86_400_000
    ).length;
    if (rolling === null || graded30 < 3) continue;
    const band = rolling >= 3.8 ? "thriving" : rolling >= 3.0 ? "stable" : "support";
    const opportunity = deriveLeadCoachingTip(rows);
    members.push({
      displayName: u.displayName,
      band,
      coachingTip:
        band === "support"
          ? `${opportunity ?? "Recent notes are missing details the audit asks for."} The system has offered practice modules; a five-minute one-on-one on that area lands better than any dashboard.`
          : band === "thriving"
            ? "Thriving. Approve their store requests promptly and say so out loud — public praise is the one leaderboard this system endorses."
            : null
    });
  }

  const view: TeamView = {
    medianTimeToFile:
      timeToFile.length > 0
        ? Math.round(timeToFile.sort((a, b) => a - b)[Math.floor(timeToFile.length / 2)])
        : null,
    afterHoursFilings: pendingAfterHours,
    narrativeReadyRate: justifiable > 0 ? justified / justifiable : null,
    redemptions: (await listRedemptions(db)).map((r) => ({
      id: r.id,
      userName: r.userName,
      itemTitle: r.itemTitle,
      cost: r.cost,
      status: r.status,
      createdAt: r.createdAt.toISOString()
    }))
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Team documentation health</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Practice-wide timing and narrative completeness, plus store fulfillment. This page does
        not name people or grade them — coaching stays a conversation, not a dashboard band.
      </p>
      <TeamDashboard view={view} />
    </div>
  );
}
