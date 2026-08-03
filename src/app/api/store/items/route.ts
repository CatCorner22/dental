import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listStoreItems, upsertStoreItem } from "@/lib/db/repo/gamify";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";

export const runtime = "nodejs";

// Store catalog management — Team Lead and above. The store is the lead's
// instrument; the app only insists the economy stays honest (positive
// integer costs, audit-logged changes).

export async function GET(): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const items = await listStoreItems(db, true);
  return Response.json({ items });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const title = typeof b.title === "string" ? sanitizeIdentity(b.title).slice(0, 120) : "";
  const detail = typeof b.detail === "string" ? sanitizeIdentity(b.detail).slice(0, 300) : "";
  const cost = typeof b.cost === "number" && Number.isInteger(b.cost) ? b.cost : NaN;
  const tier = typeof b.tier === "number" && Number.isInteger(b.tier) ? b.tier : 1;
  const active = b.active !== false;
  const id = typeof b.id === "number" ? b.id : undefined;
  if (!title || !(cost > 0) || cost > 1_000_000 || tier < 1 || tier > 5) {
    return Response.json(
      { error: "A store item needs a title, a positive cost, and a tier from 1 to 5." },
      { status: 422 }
    );
  }
  const db = await getDb();
  const item = await upsertStoreItem(db, { id, title, detail, cost, tier, active });
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: id ? "store.item-updated" : "store.item-created",
    target: String(item.id),
    detail: `${title} (${cost} pts, tier ${tier}${active ? "" : ", inactive"})`
  });
  return Response.json({ id: item.id }, { status: id ? 200 : 201 });
}
