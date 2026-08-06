import { redirect } from "next/navigation";

import { freshSessionUser } from "@/lib/auth/freshUser";
import { canManagePracticePacks } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listPackEvents, listPracticePacks } from "@/lib/db/repo/practicePacks";
import { WorkflowBoard } from "@/components/workflow/WorkflowBoard";

export const runtime = "nodejs";
export const metadata = { title: "Workflow — Practice packs" };

export default async function WorkflowPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!canManagePracticePacks(user.role)) redirect("/");

  const db = await getDb();
  const [packs, events] = await Promise.all([listPracticePacks(db), listPackEvents(db)]);

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-1">Workflow</h1>
      <p className="mb-4 text-sm text-slate-600">
        Practice packs save chairside time. Team Leads build them from shipped starters, a second
        Lead approves, and history keeps every change.
      </p>
      <WorkflowBoard
        currentUserId={user.id}
        initialPacks={packs.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          status: p.status,
          version: p.version,
          moduleIds: p.moduleIds ?? [],
          blockIds: p.blockIds ?? [],
          authorRoles: p.authorRoles ?? [],
          createdById: p.createdById,
          createdByName: p.createdByName,
          submittedById: p.submittedById,
          submittedByName: p.submittedByName,
          decidedByName: p.decidedByName,
          decidedNote: p.decidedNote,
          updatedAt: p.updatedAt.toISOString(),
          publishedAt: p.publishedAt?.toISOString() ?? null
        }))}
        initialEvents={events.map((e) => ({
          id: e.id,
          packId: e.packId,
          at: e.at.toISOString(),
          actorName: e.actorName,
          action: e.action,
          fromVersion: e.fromVersion,
          toVersion: e.toVersion,
          decisionNote: e.decisionNote
        }))}
      />
    </div>
  );
}
