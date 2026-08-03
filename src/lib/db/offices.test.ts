import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "./client";
import { offices } from "./schema";
import {
  listActiveOffices,
  listOffices,
  officeIdsForUser,
  officeNameFor,
  officesForPicker,
  seedOfficesIfEmpty,
  setOfficesForUser
} from "./repo/offices";
import { insertUser } from "./repo/users";
import { insertDraft } from "./repo/drafts";
import { insertSubmissionShell, listAllSubmissions } from "./repo/submissions";
import { composeStamp } from "@/lib/tickets/stamp";
import { composeNote, composeNoteText } from "@/lib/compose/composeNote";
import { activeModules } from "@/lib/modules";
import type { NoteState } from "@/lib/schema/types";

// An office is a property of the ENCOUNTER, not of the person writing it up.
//
// Staff rotate between the practice's locations, and a patient may be seen at
// one office for an emergency and another for recall. So the office is chosen
// per note, defaults to the author's usual one purely as a starting position,
// and never restricts who may write or read anything.

let db: Db;
beforeAll(async () => {
  db = await getDb();
});

const SEEDS = [
  { id: "t-and-c", name: "Town & Country Circle", shortCode: "T&C", sortOrder: 0 },
  { id: "exec-park", name: "Executive Park", shortCode: "EP", sortOrder: 1 },
  { id: "fsw", name: "Fort Sanders West", shortCode: "FSW", sortOrder: 2 }
];

describe("office seeding", () => {
  it("seeds an empty table in configured order", async () => {
    await db.delete(offices);
    expect(await seedOfficesIfEmpty(db, SEEDS)).toBe(true);
    const rows = await listOffices(db);
    expect(rows.map((o) => o.id)).toEqual(["t-and-c", "exec-park", "fsw"]);
  });

  it("NEVER re-seeds a table that already has rows", async () => {
    // Seeding is a one-time convenience, not an every-boot reconciliation. If
    // this re-asserted the configured values, a practice that renamed an
    // office through the app would find the old name back after the next
    // deploy — and stop trusting the software.
    await db
      .update(offices)
      .set({ name: "Renamed By The Practice" })
      .where(eq(offices.id, "t-and-c"));
    expect(await seedOfficesIfEmpty(db, SEEDS)).toBe(false);
    const [renamed] = (await listOffices(db)).filter((o) => o.id === "t-and-c");
    expect(renamed.name).toBe("Renamed By The Practice");
    await db.update(offices).set({ name: "Town & Country Circle" }).where(eq(offices.id, "t-and-c"));
  });

  it("keeps a retired office readable but out of the picker", async () => {
    // Where care happened is a fact about the past. Retiring a location must
    // not make three years of notes unlabelable.
    await db.update(offices).set({ active: false }).where(eq(offices.id, "fsw"));
    expect((await listActiveOffices(db)).map((o) => o.id)).toEqual(["t-and-c", "exec-park"]);
    expect((await listOffices(db)).map((o) => o.id)).toContain("fsw");
    expect(await officeNameFor(db, "fsw")).toBe("Fort Sanders West");
    await db.update(offices).set({ active: true }).where(eq(offices.id, "fsw"));
  });

  it("returns null for an unknown office rather than a placeholder", async () => {
    // The stamp omits the line entirely when this is null. "Unknown office" in
    // a legal record reads as a finding about the visit rather than a gap in
    // the software.
    expect(await officeNameFor(db, "no-such-office")).toBeNull();
    expect(await officeNameFor(db, null)).toBeNull();
  });
});

describe("the office appears where a reader checks it", () => {
  const state: NoteState = { selectedModuleIds: [], values: {} };

  it("puts the office in the note HEADER, not the footer", () => {
    const md = composeNote(state, activeModules([]), { officeName: "Executive Park" });
    expect(md).toContain("Executive Park");
    // A reader confirming they have the right chart open scans the first
    // lines; a wrong-office paste is exactly what that scan should catch.
    const officeLine = md.split("\n").findIndex((l) => l.includes("Executive Park"));
    const firstSection = md.split("\n").findIndex((l) => l.startsWith("## "));
    expect(officeLine).toBeGreaterThanOrEqual(0);
    if (firstSection >= 0) expect(officeLine).toBeLessThan(firstSection);
  });

  it("omits the line entirely when no office is set", () => {
    const md = composeNote(state, activeModules([]), {});
    expect(md).not.toContain("Office:");
  });

  it("strips markdown emphasis from the plain-text copy", () => {
    // The .txt copy is what gets pasted into Curve Hero. Asterisks must not
    // travel with it.
    const txt = composeNoteText(state, activeModules([]), { officeName: "Fort Sanders West" });
    expect(txt).toContain("Office: Fort Sanders West");
    expect(txt).not.toContain("**");
  });

  it("stamps the office onto the frozen record", () => {
    const stamp = composeStamp({
      ticket: "SN-000123",
      submittedBy: "Dana Reyes (dreyes)",
      submittedAtEt: "2026-08-03 09:14 ET",
      ruleVersion: "1.0.0",
      auditStatus: "READY FOR CLINICIAN REVIEW",
      officeName: "Town & Country Circle"
    });
    expect(stamp).toContain("- Office: Town & Country Circle");
  });

  it("omits the stamp line when the office is unknown", () => {
    const stamp = composeStamp({
      ticket: "SN-000124",
      submittedBy: "Dana Reyes (dreyes)",
      submittedAtEt: "2026-08-03 09:14 ET",
      ruleVersion: "1.0.0",
      auditStatus: "READY FOR CLINICIAN REVIEW"
    });
    expect(stamp).not.toContain("Office:");
    // and the rest of the record is unaffected
    expect(stamp).toContain("- Ticket: SN-000124");
  });
});

describe("the frozen office name is history, not a live lookup", () => {
  it("survives the office being renamed AND retired after the note was filed", async () => {
    // The invariant this whole design turns on, and the one that would fail
    // silently. Where care happened is a fact about a past encounter; the
    // practice reorganising its locations must not retroactively move a filed
    // note to an office it was never written at.
    await db.delete(offices);
    await seedOfficesIfEmpty(db, SEEDS);

    const u = await insertUser(db, {
      id: crypto.randomUUID(),
      username: `officeuser-${Date.now()}`,
      displayName: "Office User",
      role: "user",
      passHash: "x"
    });
    const d = await insertDraft(db, {
      id: crypto.randomUUID(),
      ownerId: u.id,
      noteState: { selectedModuleIds: [], values: {} }
    });

    // Filed at Executive Park, with the name resolved and frozen at file time.
    const officeName = await officeNameFor(db, "exec-park");
    expect(officeName).toBe("Executive Park");
    const filed = await insertSubmissionShell(db, {
      draftId: d.id,
      submittedById: u.id,
      submittedByName: "Office User (officeuser)",
      submittedAtEt: "2026-08-03 09:00 EDT",
      filename: "note",
      format: "md",
      ruleVersion: "2.0.0",
      auditStatus: "READY FOR CLINICIAN REVIEW",
      officeId: "exec-park",
      officeName
    });

    // The practice renames it and then closes it entirely.
    await db
      .update(offices)
      .set({ name: "Executive Park — West Wing", active: false })
      .where(eq(offices.id, "exec-park"));

    const rows = await listAllSubmissions(db, { limit: 50, offset: 0 });
    const mine = rows.find((r) => r.id === filed.id);
    expect(mine?.officeName).toBe("Executive Park");
    expect(mine?.officeName).not.toContain("West Wing");
  });
});

describe("office assignments are a SET, and never a permission", () => {
  it("lets one person be assigned to several offices", async () => {
    // The whole reason a single default was wrong: staff rotate, so most
    // people genuinely work at more than one location.
    await db.delete(offices);
    await seedOfficesIfEmpty(db, SEEDS);
    const u = await insertUser(db, {
      id: crypto.randomUUID(),
      username: `multi-${Date.now()}`,
      displayName: "Rotating Hygienist",
      role: "user",
      passHash: "x"
    });
    await setOfficesForUser(db, u.id, ["t-and-c", "fsw"]);
    expect((await officeIdsForUser(db, u.id)).sort()).toEqual(["fsw", "t-and-c"]);
  });

  it("replaces the whole set rather than accumulating", async () => {
    const u = await insertUser(db, {
      id: crypto.randomUUID(),
      username: `moved-${Date.now()}`,
      displayName: "Moved",
      role: "user",
      passHash: "x"
    });
    await setOfficesForUser(db, u.id, ["t-and-c", "fsw"]);
    await setOfficesForUser(db, u.id, ["exec-park"]);
    // Someone moved off a location must not still be assigned to it.
    expect(await officeIdsForUser(db, u.id)).toEqual(["exec-park"]);
    await setOfficesForUser(db, u.id, []);
    expect(await officeIdsForUser(db, u.id)).toEqual([]);
  });

  it("orders the picker by assignment but NEVER shortens it", async () => {
    // The one thing this must not do is make an office harder to reach than
    // the visit requires. A patient can be seen anywhere and cover is arranged
    // at short notice, so the full list is always present — assignment only
    // decides what appears first.
    const u = await insertUser(db, {
      id: crypto.randomUUID(),
      username: `picker-${Date.now()}`,
      displayName: "Picker",
      role: "user",
      passHash: "x"
    });
    const everything = (await listActiveOffices(db)).map((o) => o.id).sort();
    await setOfficesForUser(db, u.id, ["fsw"]);
    const shown = await officesForPicker(db, u.id);
    expect(shown[0].id).toBe("fsw");
    expect(shown.map((o) => o.id).sort()).toEqual(everything);
  });

  it("shows every office to someone with no assignments at all", async () => {
    const u = await insertUser(db, {
      id: crypto.randomUUID(),
      username: `none-${Date.now()}`,
      displayName: "Unassigned",
      role: "user",
      passHash: "x"
    });
    const shown = await officesForPicker(db, u.id);
    expect(shown.map((o) => o.id).sort()).toEqual(
      (await listActiveOffices(db)).map((o) => o.id).sort()
    );
  });
});
