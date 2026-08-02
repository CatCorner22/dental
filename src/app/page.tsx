import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { listAllDrafts, listDraftsByOwner } from "@/lib/db/repo/drafts";
import { statRowsForUser } from "@/lib/db/repo/submissions";
import { getUserById } from "@/lib/db/repo/users";
import { computeStats } from "@/lib/stats/computeStats";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { DraftStatus } from "@/lib/status/draftStatus";

export const runtime = "nodejs";
export const metadata = { title: "Dashboard — Dental Note Builder" };

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user; // middleware guarantees a session here
  const db = await getDb();
  const rows =
    user.role === "user" ? await listDraftsByOwner(db, user.id) : await listAllDrafts(db);

  // Owner display names for the admin/readonly "all drafts" view.
  const ownerNames: Record<string, string> = {};
  if (user.role !== "user") {
    for (const ownerId of new Set(rows.map((d) => d.ownerId))) {
      ownerNames[ownerId] = (await getUserById(db, ownerId))?.displayName ?? "unknown";
    }
  }

  const stats = computeStats(await statRowsForUser(db, user.id));

  return (
    <Dashboard
      role={user.role}
      displayName={user.displayName}
      canEdit={user.role !== "readonly"}
      drafts={rows.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status as DraftStatus,
        ownerName: ownerNames[d.ownerId],
        updatedAt: d.updatedAt.toISOString()
      }))}
      stats={stats}
    />
  );
}
