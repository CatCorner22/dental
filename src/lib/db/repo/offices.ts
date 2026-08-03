import { asc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { offices, type OfficeRow } from "../schema";

/**
 * Every office, active first, in configured order.
 *
 * Retired offices are still returned. A note filed three years ago at a
 * location the practice has since closed must still say where it happened, and
 * the history page must still be able to label it — so "active" governs what
 * appears in the PICKER, not what exists.
 */
export async function listOffices(db: Db): Promise<OfficeRow[]> {
  return db.select().from(offices).orderBy(asc(offices.sortOrder), asc(offices.name));
}

export async function listActiveOffices(db: Db): Promise<OfficeRow[]> {
  const all = await listOffices(db);
  return all.filter((o) => o.active);
}

export async function getOffice(db: Db, id: string): Promise<OfficeRow | undefined> {
  const [row] = await db.select().from(offices).where(eq(offices.id, id)).limit(1);
  return row;
}

/**
 * Resolve the name to freeze onto a submission.
 *
 * Returns null rather than a placeholder when the office is unknown, so the
 * stamp can omit the line entirely instead of asserting "Unknown office" —
 * which reads like a finding about the encounter rather than a gap in the
 * record.
 */
export async function officeNameFor(db: Db, id: string | null): Promise<string | null> {
  if (!id) return null;
  const row = await getOffice(db, id);
  return row?.name ?? null;
}

export interface OfficeSeed {
  id: string;
  name: string;
  shortCode: string;
  address?: string;
  phone?: string;
  sortOrder?: number;
}

/**
 * Insert the configured offices if — and only if — the table is empty.
 *
 * Same shape as the first-admin bootstrap: seeding is a one-time convenience
 * for a fresh deployment, never an every-boot reconciliation. Re-asserting the
 * seed on each start would silently undo a rename the practice made through
 * the app, which is the sort of thing that makes an operator stop trusting the
 * software.
 */
export async function seedOfficesIfEmpty(db: Db, seeds: OfficeSeed[]): Promise<boolean> {
  if (seeds.length === 0) return false;
  const existing = await db.select().from(offices).limit(1);
  if (existing.length > 0) return false;
  await db.insert(offices).values(
    seeds.map((s, i) => ({
      id: s.id,
      name: s.name,
      shortCode: s.shortCode,
      address: s.address ?? null,
      phone: s.phone ?? null,
      exportEmail: null,
      active: true,
      sortOrder: s.sortOrder ?? i
    }))
  );
  return true;
}
