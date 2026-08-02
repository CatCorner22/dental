import { requireRole } from "@/lib/auth/guards";
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
import { statusForNote } from "@/lib/status/statusForNote";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function canWrite(role: string, ownerId: string, userId: string): boolean {
  return role === "admin" || (role === "user" && ownerId === userId);
}

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Not found." }, { status: 404 });
  // A user may only open their own draft; readonly/admin may open any.
  if (guard.user.role === "user" && draft.ownerId !== guard.user.id) {
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
  if (!canWrite(guard.user.role, draft.ownerId, guard.user.id)) {
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

  const patch: { title?: string; noteState?: typeof draft.noteState; status?: string; lastSendFailed?: boolean } = {};
  if (typeof b.title === "string") patch.title = b.title.trim().slice(0, 200) || "Untitled note";
  if (b.note !== undefined) {
    const res = validateNoteState(b.note);
    if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
    patch.noteState = res.value;
    // An edit means this is no longer the note that failed to send, so clear
    // the send-failed flag here too — otherwise the dashboard keeps showing
    // "Send failed" while the open builder shows the live status, a parity
    // break between the two derivations.
    patch.lastSendFailed = false;
    const derived = statusForNote(res.value, { submitted: false, lastSendFailed: false });
    patch.status = derived.status;
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
  if (!canWrite(guard.user.role, draft.ownerId, guard.user.id)) {
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
