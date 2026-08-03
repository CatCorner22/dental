import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { canManageUsers } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listUsers } from "@/lib/db/repo/users";
import { statRowsForUser } from "@/lib/db/repo/submissions";
import { listRedemptions, seedStoreIfEmpty } from "@/lib/db/repo/gamify";
import { STARTER_STORE } from "@/lib/gamify/economy";
import { computeStats, rollingGpa } from "@/lib/stats/computeStats";
import { deriveInsights } from "@/lib/gamify/insights";
import { TeamDashboard, type TeamView } from "@/components/admin/TeamDashboard";

export const runtime = "nodejs";
export const metadata = { title: "Team health" };

// The Team Lead dashboard: macro documentation health, the coaching matrix,
// and store fulfillment. THE PRIVACY CONTRACT, enforced here where the data
// is assembled: a lead sees each person's coaching BAND and a coaching tip —
// never per-note scores, never a ranked table, never another person's
// dashboard. The band is the signal a lead can act on; the rest is
// surveillance dressed as management.

export default async function TeamPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!canManageUsers(user.role)) redirect("/");
  const db = await getDb();
  await seedStoreIfEmpty(db, STARTER_STORE);

  const users = (await listUsers(db)).filter((u) => u.active && u.role !== "readonly");

  const members: TeamView["members"] = [];
  let clinicGpaSum = 0;
  let clinicGpaN = 0;
  let pendingAfterHours = 0;
  const timeToFile: number[] = [];
  let justified = 0;
  let justifiable = 0;

  for (const u of users) {
    const rows = await statRowsForUser(db, u.id);
    const rolling = rollingGpa(rows);
    const stats = computeStats(rows);
    if (stats.medianMinutesToFile !== null) timeToFile.push(stats.medianMinutesToFile);
    pendingAfterHours += stats.afterHoursCount;
    for (const r of rows) {
      if (!r.gpa) continue;
      clinicGpaSum += parseFloat(r.gpa);
      clinicGpaN++;
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
    const opportunity = deriveInsights(rows).find((line) => line.startsWith("Most room"));
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
    clinicGpa: clinicGpaN > 0 ? Math.round((clinicGpaSum / clinicGpaN) * 100) / 100 : null,
    medianTimeToFile:
      timeToFile.length > 0
        ? Math.round(timeToFile.sort((a, b) => a - b)[Math.floor(timeToFile.length / 2)])
        : null,
    afterHoursFilings: pendingAfterHours,
    narrativeReadyRate: justifiable > 0 ? justified / justifiable : null,
    members: members.sort((a, b) => a.displayName.localeCompare(b.displayName)),
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
        Macro numbers, coaching bands, and store fulfillment. Bands — never scores, never
        rankings: the point is knowing where five minutes of your time helps most, and staff are
        told exactly what this page shows about them.
      </p>
      <TeamDashboard view={view} />
    </div>
  );
}
