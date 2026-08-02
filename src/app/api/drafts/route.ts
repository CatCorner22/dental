import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { insertDraft, listAllDrafts, listDraftsByOwner } from "@/lib/db/repo/drafts";
import { readJsonRecord } from "@/lib/http/readJson";
import { validateNoteState } from "@/lib/schema/validateNoteState";
import { statusForNote } from "@/lib/status/statusForNote";
import type { NoteState } from "@/lib/schema/types";

export const runtime = "nodejs";

const EMPTY: NoteState = { selectedModuleIds: [], values: {} };

// readonly + admin see all drafts; a user sees their own.
export async function GET(): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const rows =
    guard.user.role === "user"
      ? await listDraftsByOwner(db, guard.user.id)
      : await listAllDrafts(db);
  return Response.json({
    drafts: rows.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      ownerId: d.ownerId,
      version: d.version,
      updatedAt: d.updatedAt
    }))
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind === "invalid") {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const b: Record<string, unknown> = parsed.kind === "object" ? parsed.value : {};
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 200) : "Untitled note";
  let note: NoteState = EMPTY;
  if (b.note !== undefined) {
    const res = validateNoteState(b.note);
    if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
    note = res.value;
  }
  const db = await getDb();
  // Cache the derived status at creation exactly like the PATCH path does —
  // otherwise a complete note created via POST shows "Unfinished" on the
  // dashboard until its first save recomputes it.
  const derived = statusForNote(note, { submitted: false, lastSendFailed: false });
  const draft = await insertDraft(db, {
    id: crypto.randomUUID(),
    ownerId: guard.user.id,
    title,
    noteState: note,
    status: derived.status
  });
  return Response.json({ id: draft.id }, { status: 201 });
}
