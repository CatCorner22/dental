import { requireRole } from "@/lib/auth/guards";
import { canWriteNote, seesAllNotes } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import {
  getDraft,
  getDraftRevision,
  listDraftRevisions,
  updateDraftChecked
} from "@/lib/db/repo/drafts";
import { readJsonRecord } from "@/lib/http/readJson";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { statusForNote } from "@/lib/status/statusForNote";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Working-copy revision list (autosave ring) — not filed submission history. */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  if (!seesAllNotes(guard.user.role) && draft.ownerId !== guard.user.id) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const revisions = await listDraftRevisions(db, id);
  return Response.json({
    currentVersion: draft.version,
    revisions: revisions.map((r) => ({
      id: r.id,
      version: r.version,
      title: r.title,
      officeId: r.officeId,
      savedAt: r.savedAt
    }))
  });
}

/**
 * Restore a prior working-copy revision onto the live draft.
 * Requires baseVersion for OCC; body: { revisionId, baseVersion }.
 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  if (!canWriteNote(guard.user.role, draft.ownerId, guard.user.id)) {
    return Response.json({ error: "You cannot edit this draft." }, { status: 403 });
  }

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = parsed.value;
  if (typeof b.revisionId !== "number" || !Number.isInteger(b.revisionId)) {
    return Response.json({ error: "revisionId must be an integer." }, { status: 400 });
  }
  if (typeof b.baseVersion !== "number" || !Number.isInteger(b.baseVersion)) {
    return Response.json({ error: "baseVersion must be an integer." }, { status: 400 });
  }

  const revision = await getDraftRevision(db, id, b.revisionId);
  if (!revision) {
    return Response.json({ error: "That revision was not found." }, { status: 404 });
  }

  const updated = await updateDraftChecked(
    db,
    id,
    b.baseVersion,
    {
      title: revision.title,
      officeId: revision.officeId,
      noteState: revision.noteState,
      lastSendFailed: false,
      lastSubmissionId: null,
      status: statusForNote(revision.noteState, {
        submitted: false,
        lastSendFailed: false,
        clinicalRole:
          (guard.user as { clinicalRole?: ClinicalRole }).clinicalRole ?? "unset"
      }).status
    },
    new Date()
  );
  if (!updated) {
    return Response.json(
      { error: "conflict", version: draft.version, updatedAt: draft.updatedAt },
      { status: 409 }
    );
  }
  return Response.json({
    version: updated.version,
    title: updated.title,
    officeId: updated.officeId,
    note: updated.noteState,
    status: updated.status,
    savedAt: updated.updatedAt
  });
}
