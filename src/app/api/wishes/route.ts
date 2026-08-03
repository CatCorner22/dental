import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { insertWish, listWishes } from "@/lib/db/repo/wishes";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";
import { sanitizeMultiline } from "@/lib/text/sanitizeMultiline";
import { wishError, WISH_DETAIL_MAX, type WishCategory } from "@/lib/wishes/wishes";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";

export const runtime = "nodejs";

// Generous. This is a suggestion box, and the failure mode to avoid is someone
// being told to come back later when they have just seen something wrong.
const FREE_WISHES = 40;

// ANYONE signed in may raise a wish, including a read-only account.
//
// That is deliberate and it is the most important access decision in this file.
// A read-only account belongs to someone who is in the building — a locum, a
// temp, a student, a biller walking past an empty glove box. Requiring the
// ability to author a clinical note before you may report that something is
// below standard would silence exactly the people most likely to notice.
export async function GET(): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const rows = await listWishes(db);
  return Response.json({
    wishes: rows.map((w) => ({
      id: w.id,
      authorName: w.authorName,
      category: w.category,
      title: w.title,
      detail: w.detail,
      status: w.status,
      decidedByName: w.decidedByName,
      decidedNote: w.decidedNote,
      createdAt: w.createdAt.toISOString()
    }))
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const title = typeof b.title === "string" ? sanitizeIdentity(b.title) : "";
  const detail = typeof b.detail === "string" ? sanitizeMultiline(b.detail, WISH_DETAIL_MAX) : "";

  const bad = wishError({ category: b.category, title, detail });
  if (bad) return Response.json({ error: bad }, { status: 422 });

  const db = await getDb();
  const now = new Date();
  const key = `wish:${guard.user.id}`;
  const meter = await checkThrottle(db, key, now);
  if (meter.locked) {
    return Response.json(
      { error: `That is a lot of entries at once. Try again in ${meter.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }
  await recordFailure(db, key, now, FREE_WISHES);

  // Non-anonymous, at the owner's request — and the name is FROZEN here like
  // every other attribution in this app, so a later rename or deletion cannot
  // rewrite who raised something.
  const row = await insertWish(db, {
    authorId: guard.user.id,
    authorName: `${guard.user.displayName} (${guard.user.username})`,
    category: b.category as WishCategory,
    title,
    detail,
    status: "new",
    createdAt: now,
    updatedAt: now
  });

  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: b.category === "standards" ? "wish.standards-concern" : "wish.create",
    target: String(row.id),
    detail: title
  });

  return Response.json({ id: row.id }, { status: 201 });
}
