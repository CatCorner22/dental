import { requireRole } from "@/lib/auth/guards";
import { seesAllNotes } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import {
  countAllDrafts,
  insertDraft,
  listAllDrafts,
  listDraftsByOwner,
  ownerDraftCount
} from "@/lib/db/repo/drafts";
import { parsePageParams } from "@/lib/http/pagination";
import { readJsonRecord } from "@/lib/http/readJson";
import { validateNoteState } from "@/lib/schema/validateNoteState";
import { checkScope } from "@/lib/schema/scopeGuard";
import { activeModules } from "@/lib/modules";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { statusForNote } from "@/lib/status/statusForNote";
import type { NoteState } from "@/lib/schema/types";

export const runtime = "nodejs";

const MAX_DRAFTS_PER_USER = 500;

const EMPTY: NoteState = { selectedModuleIds: [], values: {} };

// readonly + admin see all drafts; a user sees their own.
export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const page = parsePageParams(req.url);
  const mine = !seesAllNotes(guard.user.role);
  const rows = mine
    ? await listDraftsByOwner(db, guard.user.id, page)
    : await listAllDrafts(db, page);
  const total = mine ? await ownerDraftCount(db, guard.user.id) : await countAllDrafts(db);
  return Response.json({
    drafts: rows.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      ownerId: d.ownerId,
      version: d.version,
      updatedAt: d.updatedAt
    })),
    total,
    limit: page.limit,
    offset: page.offset
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
    // SCOPE OF PRACTICE, on the create path too.
    //
    // checkScope lived only in PATCH, so the Tennessee rule reserving
    // diagnosis and treatment planning to the dentist was bypassable by
    // choosing a different HTTP verb: POST the whole assessment at creation
    // and every later PATCH compares equal and passes. The permanent record
    // then documents an assistant as the author of a diagnosis — the exact act
    // clinicalRoles.ts calls outside that person's scope.
    //
    // Compared against an EMPTY note because at creation every value is being
    // authored for the first time; there is no previous state to carry.
    const scope = checkScope(
      (guard.user as { clinicalRole?: ClinicalRole }).clinicalRole ?? "unset",
      activeModules(res.value.selectedModuleIds),
      res.value,
      EMPTY
    );
    if (!scope.ok) {
      return Response.json(
        { error: scope.message, blockedFields: scope.blocked, reason: "scope" },
        { status: 403 }
      );
    }
    note = res.value;
  }
  const db = await getDb();
  // A ceiling far above any real workload: a clinician's open drafts are a
  // working set, not an archive (submitted notes live in history). Without
  // it, one account can mint unlimited ~120KB rows that every admin list
  // view then has to read.
  if ((await ownerDraftCount(db, guard.user.id)) >= MAX_DRAFTS_PER_USER) {
    return Response.json(
      {
        error: `You have ${MAX_DRAFTS_PER_USER} drafts open, the maximum. Submit or delete one before starting another.`
      },
      { status: 409 }
    );
  }
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
