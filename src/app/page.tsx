import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { listAllDrafts, listDraftsByOwner } from "@/lib/db/repo/drafts";
import { statRowsForUser } from "@/lib/db/repo/submissions";
import { listUsers } from "@/lib/db/repo/users";
import { computeStats } from "@/lib/stats/computeStats";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { DraftStatus } from "@/lib/status/draftStatus";

export const runtime = "nodejs";
export const metadata = { title: "Dashboard — Dental Note Builder" };

export default async function DashboardPage() {
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  const rows =
    user.role === "user" ? await listDraftsByOwner(db, user.id) : await listAllDrafts(db);

  // Owner display names for the admin/readonly "all drafts" view — one query.
  const ownerNames: Record<string, string> = {};
  if (user.role !== "user") {
    for (const u of await listUsers(db)) ownerNames[u.id] = u.displayName;
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
        mine: d.ownerId === user.id,
        updatedAt: d.updatedAt.toISOString(),
        moduleIds: d.noteState.selectedModuleIds
      }))}
      stats={stats}
    />
  );
}
