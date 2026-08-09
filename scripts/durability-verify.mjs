// After the restart: prove the record is still there, through the app's own
// API rather than by reading Postgres directly — a row that exists but is
// unreachable to the app is not a surviving record. See postgres-durability.sh.
import { chromium } from "playwright";
import { signIn } from "../e2e/_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const TICKET = process.env.TICKET || "";
const DRAFT = process.env.DRAFT || "";

let bad = 0;
const check = (c, l) => { console.log(`      ${c ? "ok  " : "FAIL"}  ${l}`); if (!c) bad++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// The seeded admin still signs in — the password hash survived.
await signIn(page, BASE);
check(true, "the admin account signs in after the restart");

// The account created BEFORE the restart still signs in: proof a user row
// written by the previous process persisted, not just the boot-time seed.
const octx = await browser.newContext();
const op = await octx.newPage();
let ownerOk = true;
try {
  await signIn(op, BASE, "durable1", "durable1-pass-12345");
} catch {
  ownerOk = false;
}
check(ownerOk, "an account created before the restart still signs in");
await octx.close();

// The filed submission — the legal record. It must still be there, with its
// frozen content, under the same ticket.
const subs = (await (await ctx.request.get(`${BASE}/api/submissions?limit=50`)).json()).submissions ?? [];
const mine = subs.find((s) => s.ticket === TICKET);
check(Boolean(mine), `the filed submission survives under its ticket (${TICKET})`);
check(
  Boolean(mine) && typeof mine.ruleVersion === "string" && mine.ruleVersion.length > 0,
  `the frozen ruleset stamp survives (${mine?.ruleVersion ?? "none"})`
);

// The frozen FILENAME — the emailed attachment's name, and the field the
// history list deliberately omits from its slim projection (see the route:
// it sends id/ticket/actor/office/time/status/version and nothing else). The
// CSV export is the app surface that carries it, so read it there rather than
// going behind the app into Postgres: a row that exists but is unreachable
// through the app is not a surviving record.
const csv = await ctx.request.get(`${BASE}/api/export/submissions`);
const csvText = csv.ok() ? await csv.text() : "";
check(
  csvText.includes("durability-check-visit"),
  `the frozen filename survives into the export (${csv.status()})`
);

// The open draft — unfinished work is the thing a clinician would lose.
if (DRAFT) {
  const dr = await ctx.request.get(`${BASE}/api/drafts/${DRAFT}`);
  check(dr.ok(), `the open draft survives and is readable (${dr.status()})`);
}

// The audit trail — traceability cannot restart from zero.
await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
const rows = await page.evaluate(() =>
  [...document.querySelectorAll("tbody tr")].map((tr) => tr.textContent ?? "")
);
check(rows.some((r) => r.includes("Note submitted")), "the filing's audit row survives");
check(rows.some((r) => r.includes("User created")), "the account-creation audit row survives");

await browser.close();
process.exit(bad === 0 ? 0 : 1);
