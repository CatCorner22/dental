import { requireRole } from "@/lib/auth/guards";
import { canWriteNote, seesAllNotes } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import {
  deleteDraft,
  draftSubmissionCount,
  getDraft,
  updateDraftChecked
} from "@/lib/db/repo/drafts";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { validateNoteState } from "@/lib/schema/validateNoteState";
import { filedNoteEqual } from "@/lib/compose/filedNoteEqual";
import { statusForNote } from "@/lib/status/statusForNote";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  // Scoped viewers see only their own; oversight roles may open any.
  if (!seesAllNotes(guard.user.role) && draft.ownerId !== guard.user.id) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({ draft });
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
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
  // Must be a whole number: NaN/Infinity/1.5 would otherwise reach the
  // integer version column and fail as an unhandled 500 instead of a 400.
  if (typeof b.baseVersion !== "number" || !Number.isInteger(b.baseVersion)) {
    return Response.json({ error: "baseVersion must be an integer." }, { status: 400 });
  }

  const patch: {
    title?: string;
    noteState?: typeof draft.noteState;
    status?: string;
    lastSendFailed?: boolean;
    lastSubmissionId?: number | null;
  } = {};
  if (typeof b.title === "string") patch.title = b.title.trim().slice(0, 200) || "Untitled note";
  if (b.note !== undefined) {
    const res = validateNoteState(b.note);
    if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
    patch.noteState = res.value;
    // Only a REAL content change re-opens the submit gate. The client autosaves
    // note + title together on every keystroke, so a title-only rename arrives
    // here carrying the unchanged note. Clearing the re-file guard on the mere
    // PRESENCE of a note key (rather than an actual change) let a rename after
    // a submit file a second, byte-identical ticket for the same encounter.
    // "Changed" is measured on the COMPOSED note — the artifact that freezes
    // into the ticket — not on raw NoteState: composition normalizes value
    // order, whitespace, and stray otherText, so a raw compare would report a
    // spurious change (e.g. re-toggling a multiselect chip reorders its array)
    // and re-open the gate for an output-identical edit.
    const noteChanged = !filedNoteEqual(res.value, draft.noteState);
    if (noteChanged) {
      // The note is no longer the one that failed to send, nor the one already
      // on file, so both flags clear and the status is recomputed live. This is
      // what makes an edited draft submittable again after a filing.
      patch.lastSendFailed = false;
      patch.lastSubmissionId = null;
      patch.status = statusForNote(res.value, { submitted: false, lastSendFailed: false }).status;
    }
  }

  const updated = await updateDraftChecked(db, id, b.baseVersion, patch, new Date());
  if (!updated) {
    return Response.json(
      { error: "conflict", version: draft.version, updatedAt: draft.updatedAt },
      { status: 409 }
    );
  }
  return Response.json({
    version: updated.version,
    status: updated.status,
    savedAt: updated.updatedAt
  });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  if (!canWriteNote(guard.user.role, draft.ownerId, guard.user.id)) {
    return Response.json({ error: "You cannot delete this draft." }, { status: 403 });
  }
  if ((await draftSubmissionCount(db, id)) > 0) {
    return Response.json(
      { error: "This draft has submissions and cannot be deleted; its history must survive." },
      { status: 409 }
    );
  }
  await deleteDraft(db, id);
  // Deletion is the one place the row itself vanishes, so the audit log is
  // the only surviving record of who removed what (an admin may delete a
  // draft they do not own — the owner deserves a trace, not a mystery).
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "draft.delete",
    target: draft.title,
    detail: `${draft.id} (owner ${draft.ownerId})`
  });
  return new Response(null, { status: 204 });
}
