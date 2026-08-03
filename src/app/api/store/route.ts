import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import {
  balanceFor,
  listRedemptions,
  listStoreItems,
  requestRedemption,
  seedStoreIfEmpty
} from "@/lib/db/repo/gamify";
import { STARTER_STORE } from "@/lib/gamify/economy";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";

export const runtime = "nodejs";

// The clinic store. Points are morale currency the PRACTICE fulfils — the
// app tracks the request and the decision, never the coffee. Anyone who can
// author a note can redeem; the balance check and the spend are one
// transaction, so two tabs cannot spend the same points.

export async function GET(): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  await seedStoreIfEmpty(db, STARTER_STORE);
  const [items, balance, mine] = await Promise.all([
    listStoreItems(db),
    balanceFor(db, guard.user.id),
    listRedemptions(db, guard.user.id)
  ]);
  return Response.json({
    balance,
    items: items.map((i) => ({ id: i.id, title: i.title, detail: i.detail, cost: i.cost, tier: i.tier })),
    redemptions: mine.map((r) => ({
      id: r.id,
      itemTitle: r.itemTitle,
      cost: r.cost,
      status: r.status,
      decidedNote: r.decidedNote,
      createdAt: r.createdAt.toISOString()
    }))
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object" || typeof parsed.value.itemId !== "number") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const db = await getDb();
  const result = await requestRedemption(db, {
    userId: guard.user.id,
    userName: `${guard.user.displayName} (${guard.user.username})`,
    itemId: parsed.value.itemId
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "store.redeem-requested",
    target: String(result.redemption.id),
    detail: `${result.redemption.itemTitle} (${result.redemption.cost} pts)`
  });
  return Response.json({ id: result.redemption.id }, { status: 201 });
}
