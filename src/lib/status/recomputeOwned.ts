import { and, eq, ne } from "drizzle-orm";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import type { Db } from "@/lib/db/client";
import { drafts } from "@/lib/db/schema";
import { statusForNote } from "./statusForNote";

/**
 * Restamp cached draft status for every open note owned by `ownerId`, using
 * that owner's clinical role. Used when:
 * - a clinical role is assigned/changed (list chips would otherwise lie until
 *   the next content save), and
 * - drafts move in a merge (same class of Andon lie as transfer).
 *
 * Submitted rows are left alone — filed status is history, not a finish cue.
 */
export async function recomputeOpenDraftStatusesForOwner(
  db: Db,
  ownerId: string,
  clinicalRole: ClinicalRole,
  now: Date = new Date()
): Promise<number> {
  const rows = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.ownerId, ownerId), ne(drafts.status, "submitted")));

  let changed = 0;
  for (const row of rows) {
    const next = statusForNote(row.noteState, {
      submitted: false,
      lastSendFailed: Boolean(row.lastSendFailed),
      clinicalRole
    }).status;
    if (next === row.status) continue;
    await db
      .update(drafts)
      .set({ status: next, updatedAt: now })
      .where(eq(drafts.id, row.id));
    changed += 1;
  }
  return changed;
}
