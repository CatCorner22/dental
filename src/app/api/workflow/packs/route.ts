import { requireRole } from "@/lib/auth/guards";
import { canManagePracticePacks } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { createPracticePack, listPracticePacks, listPublishedPacks } from "@/lib/db/repo/practicePacks";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { validatePackBody } from "@/lib/packs/validate";

export const runtime = "nodejs";

function actorName(user: { displayName: string; username: string }): string {
  return `${user.displayName} (${user.username})`;
}

/** List packs. Team Leads see all; writers may request published only. */
export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const publishedOnly = url.searchParams.get("status") === "published";
  const db = await getDb();
  if (publishedOnly) {
    const packs = await listPublishedPacks(db);
    return Response.json({ packs });
  }
  if (!canManagePracticePacks(guard.user.role)) {
    return Response.json({ error: "Team Lead access required." }, { status: 403 });
  }
  const packs = await listPracticePacks(db);
  return Response.json({ packs });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canManagePracticePacks(guard.user.role)) {
    return Response.json({ error: "Team Lead access required." }, { status: 403 });
  }
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = validatePackBody(parsed.value);
  if (!body.ok) return Response.json({ error: body.error }, { status: 422 });
  const db = await getDb();
  const actor = { id: guard.user.id, name: actorName(guard.user) };
  const pack = await createPracticePack(db, body.value, actor);
  await logAction(db, {
    actorId: actor.id,
    actorName: actor.name,
    action: "pack.created",
    target: String(pack.id),
    detail: pack.title
  });
  return Response.json({ pack }, { status: 201 });
}
