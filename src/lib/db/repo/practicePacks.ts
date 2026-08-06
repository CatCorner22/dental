import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import {
  practicePackEvents,
  practicePacks,
  type PracticePackEventRow,
  type PracticePackRow
} from "../schema";
import type { PackBody } from "@/lib/packs/validate";

export type PackStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "rejected"
  | "retired";

export type PackActor = { id: string; name: string };

function snapshot(row: PracticePackRow): Record<string, unknown> {
  return {
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    moduleIds: row.moduleIds,
    blockIds: row.blockIds,
    authorRoles: row.authorRoles
  };
}

async function appendEvent(
  db: Db,
  args: {
    packId: number;
    actor: PackActor;
    action: string;
    fromVersion?: number | null;
    toVersion?: number | null;
    diffJson?: Record<string, unknown> | null;
    decisionNote?: string | null;
  }
): Promise<void> {
  await db.insert(practicePackEvents).values({
    packId: args.packId,
    actorId: args.actor.id,
    actorName: args.actor.name,
    action: args.action,
    fromVersion: args.fromVersion ?? null,
    toVersion: args.toVersion ?? null,
    diffJson: args.diffJson ?? null,
    decisionNote: args.decisionNote ?? null
  });
}

export async function listPracticePacks(db: Db): Promise<PracticePackRow[]> {
  return db.select().from(practicePacks).orderBy(desc(practicePacks.updatedAt), desc(practicePacks.id));
}

export async function listPublishedPacks(db: Db): Promise<PracticePackRow[]> {
  return db
    .select()
    .from(practicePacks)
    .where(eq(practicePacks.status, "published"))
    .orderBy(desc(practicePacks.publishedAt), desc(practicePacks.id));
}

export async function getPracticePack(db: Db, id: number): Promise<PracticePackRow | null> {
  const [row] = await db.select().from(practicePacks).where(eq(practicePacks.id, id)).limit(1);
  return row ?? null;
}

export async function listPackEvents(db: Db, packId?: number): Promise<PracticePackEventRow[]> {
  if (packId !== undefined) {
    return db
      .select()
      .from(practicePackEvents)
      .where(eq(practicePackEvents.packId, packId))
      .orderBy(desc(practicePackEvents.at), desc(practicePackEvents.id))
      .limit(200);
  }
  return db
    .select()
    .from(practicePackEvents)
    .orderBy(desc(practicePackEvents.at), desc(practicePackEvents.id))
    .limit(200);
}

export async function createPracticePack(
  db: Db,
  body: PackBody,
  actor: PackActor
): Promise<PracticePackRow> {
  const [row] = await db
    .insert(practicePacks)
    .values({
      title: body.title,
      description: body.description,
      status: "draft",
      version: 1,
      moduleIds: body.moduleIds,
      blockIds: body.blockIds,
      authorRoles: body.authorRoles,
      createdById: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name
    })
    .returning();
  if (!row) throw new Error("createPracticePack failed");
  await appendEvent(db, {
    packId: row.id,
    actor,
    action: "created",
    toVersion: 1,
    diffJson: snapshot(row)
  });
  return row;
}

export async function updateDraftPack(
  db: Db,
  id: number,
  body: PackBody,
  actor: PackActor
): Promise<{ ok: true; pack: PracticePackRow } | { ok: false; error: string }> {
  const existing = await getPracticePack(db, id);
  if (!existing) return { ok: false, error: "Pack not found." };
  if (existing.status !== "draft" && existing.status !== "rejected") {
    return { ok: false, error: "Only draft or rejected packs can be edited." };
  }
  const before = snapshot(existing);
  const [row] = await db
    .update(practicePacks)
    .set({
      title: body.title,
      description: body.description,
      moduleIds: body.moduleIds,
      blockIds: body.blockIds,
      authorRoles: body.authorRoles,
      status: "draft",
      updatedByName: actor.name,
      updatedAt: new Date(),
      decidedById: null,
      decidedByName: null,
      decidedNote: null
    })
    .where(eq(practicePacks.id, id))
    .returning();
  if (!row) return { ok: false, error: "Pack not found." };
  await appendEvent(db, {
    packId: id,
    actor,
    action: "edited",
    fromVersion: existing.version,
    toVersion: existing.version,
    diffJson: { before, after: snapshot(row) }
  });
  return { ok: true, pack: row };
}

export async function submitPack(
  db: Db,
  id: number,
  actor: PackActor
): Promise<{ ok: true; pack: PracticePackRow } | { ok: false; error: string }> {
  const existing = await getPracticePack(db, id);
  if (!existing) return { ok: false, error: "Pack not found." };
  if (existing.status !== "draft" && existing.status !== "rejected") {
    return { ok: false, error: "Only a draft or rejected pack can be submitted." };
  }
  const [row] = await db
    .update(practicePacks)
    .set({
      status: "in_review",
      submittedById: actor.id,
      submittedByName: actor.name,
      updatedByName: actor.name,
      updatedAt: new Date(),
      decidedById: null,
      decidedByName: null,
      decidedNote: null
    })
    .where(eq(practicePacks.id, id))
    .returning();
  if (!row) return { ok: false, error: "Pack not found." };
  await appendEvent(db, {
    packId: id,
    actor,
    action: "submitted",
    fromVersion: existing.version,
    toVersion: existing.version
  });
  return { ok: true, pack: row };
}

export async function decidePack(
  db: Db,
  args: { id: number; approve: boolean; note: string; actor: PackActor }
): Promise<{ ok: true; pack: PracticePackRow } | { ok: false; error: string }> {
  const existing = await getPracticePack(db, args.id);
  if (!existing) return { ok: false, error: "Pack not found." };
  if (existing.status !== "in_review") {
    return { ok: false, error: "Pack is not waiting for review." };
  }
  if (existing.submittedById && existing.submittedById === args.actor.id) {
    return { ok: false, error: "A second Team Lead must approve — you cannot approve your own submission." };
  }
  if (!args.approve && !args.note.trim()) {
    return { ok: false, error: "A reject needs a short note so the author knows what to fix." };
  }
  const status: PackStatus = args.approve ? "approved" : "rejected";
  const [row] = await db
    .update(practicePacks)
    .set({
      status,
      decidedById: args.actor.id,
      decidedByName: args.actor.name,
      decidedNote: args.note.trim() || null,
      updatedByName: args.actor.name,
      updatedAt: new Date()
    })
    .where(eq(practicePacks.id, args.id))
    .returning();
  if (!row) return { ok: false, error: "Pack not found." };
  await appendEvent(db, {
    packId: args.id,
    actor: args.actor,
    action: args.approve ? "approved" : "rejected",
    fromVersion: existing.version,
    toVersion: existing.version,
    decisionNote: args.note.trim() || null
  });
  return { ok: true, pack: row };
}

export async function publishPack(
  db: Db,
  id: number,
  actor: PackActor
): Promise<{ ok: true; pack: PracticePackRow } | { ok: false; error: string }> {
  const existing = await getPracticePack(db, id);
  if (!existing) return { ok: false, error: "Pack not found." };
  if (existing.status !== "approved") {
    return { ok: false, error: "Only an approved pack can be published." };
  }
  // Retire other published packs with the same title (case-insensitive exact).
  const published = await listPublishedPacks(db);
  const sameTitle = published.filter(
    (p) => p.id !== id && p.title.trim().toLowerCase() === existing.title.trim().toLowerCase()
  );
  if (sameTitle.length) {
    await db
      .update(practicePacks)
      .set({ status: "retired", updatedAt: new Date(), updatedByName: actor.name })
      .where(
        inArray(
          practicePacks.id,
          sameTitle.map((p) => p.id)
        )
      );
    for (const p of sameTitle) {
      await appendEvent(db, {
        packId: p.id,
        actor,
        action: "retired",
        fromVersion: p.version,
        toVersion: p.version,
        decisionNote: `Retired — replaced by pack #${id}.`
      });
    }
  }
  const [row] = await db
    .update(practicePacks)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedByName: actor.name,
      updatedAt: new Date()
    })
    .where(eq(practicePacks.id, id))
    .returning();
  if (!row) return { ok: false, error: "Pack not found." };
  await appendEvent(db, {
    packId: id,
    actor,
    action: "published",
    fromVersion: existing.version,
    toVersion: existing.version,
    diffJson: snapshot(row)
  });
  return { ok: true, pack: row };
}

/**
 * Copy a published pack into a new draft (version + 1). The live pack stays
 * published until the draft is approved and published (then same-title retire).
 */
export async function revisePublishedPack(
  db: Db,
  id: number,
  actor: PackActor
): Promise<{ ok: true; pack: PracticePackRow } | { ok: false; error: string }> {
  const existing = await getPracticePack(db, id);
  if (!existing) return { ok: false, error: "Pack not found." };
  if (existing.status !== "published") {
    return { ok: false, error: "Only a published pack can be revised." };
  }
  const nextVersion = existing.version + 1;
  const [row] = await db
    .insert(practicePacks)
    .values({
      title: existing.title,
      description: existing.description,
      status: "draft",
      version: nextVersion,
      moduleIds: existing.moduleIds,
      blockIds: existing.blockIds,
      authorRoles: existing.authorRoles,
      createdById: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name
    })
    .returning();
  if (!row) return { ok: false, error: "Could not open a revision." };
  await appendEvent(db, {
    packId: row.id,
    actor,
    action: "revised",
    fromVersion: existing.version,
    toVersion: nextVersion,
    decisionNote: `Draft revision of published pack #${id}. Live pack stays up until this one publishes.`,
    diffJson: { sourcePackId: id, ...snapshot(row) }
  });
  return { ok: true, pack: row };
}
