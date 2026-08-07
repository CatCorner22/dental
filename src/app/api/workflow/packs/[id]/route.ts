import { requireRole } from "@/lib/auth/guards";
import { canManagePracticePacks } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import {
  decidePack,
  getPracticePack,
  publishPack,
  revisePublishedPack,
  submitPack,
  updateDraftPack
} from "@/lib/db/repo/practicePacks";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { validatePackBody } from "@/lib/packs/validate";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function actorOf(user: { id: string; displayName: string; username: string }) {
  return { id: user.id, name: `${user.displayName} (${user.username})` };
}

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canManagePracticePacks(guard.user.role)) {
    return Response.json({ error: "Team Lead access required." }, { status: 403 });
  }
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid id." }, { status: 400 });
  const db = await getDb();
  const pack = await getPracticePack(db, id);
  if (!pack) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ pack });
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canManagePracticePacks(guard.user.role)) {
    return Response.json({ error: "Team Lead access required." }, { status: 403 });
  }
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid id." }, { status: 400 });
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = typeof parsed.value.action === "string" ? parsed.value.action : "save";
  const db = await getDb();
  const actor = actorOf(guard.user);

  if (action === "save") {
    const body = validatePackBody(parsed.value);
    if (!body.ok) return Response.json({ error: body.error }, { status: 422 });
    const result = await updateDraftPack(db, id, body.value, actor);
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    await logAction(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "pack.edited",
      target: String(id),
      detail: result.pack.title
    });
    return Response.json({ pack: result.pack });
  }

  if (action === "submit") {
    const result = await submitPack(db, id, actor);
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    await logAction(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "pack.submitted",
      target: String(id),
      detail: result.pack.title
    });
    return Response.json({ pack: result.pack });
  }

  if (action === "decide") {
    if (typeof parsed.value.approve !== "boolean") {
      return Response.json({ error: "approve must be true or false." }, { status: 400 });
    }
    const note =
      typeof parsed.value.note === "string" ? sanitizeIdentity(parsed.value.note).slice(0, 500) : "";
    const result = await decidePack(db, {
      id,
      approve: parsed.value.approve,
      note,
      actor
    });
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    await logAction(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: parsed.value.approve ? "pack.approved" : "pack.rejected",
      target: String(id),
      detail: note || result.pack.title
    });
    return Response.json({ pack: result.pack });
  }

  if (action === "publish") {
    const result = await publishPack(db, id, actor);
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    await logAction(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "pack.published",
      target: String(id),
      detail: result.pack.title
    });
    return Response.json({ pack: result.pack });
  }

  if (action === "revise") {
    const result = await revisePublishedPack(db, id, actor);
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    await logAction(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: "pack.revised",
      target: String(result.pack.id),
      detail: `from #${id}`
    });
    return Response.json({ pack: result.pack });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
