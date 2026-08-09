// Submission-immutability drive: the filed record has no HTTP mutation surface,
// filing is atomic, and the double-submit race files exactly once. Requires a
// freshly-booted server (empty in-memory DB) with the smoke admin; see
// e2e/_noteSeed.mjs for how a note is filled to fileable on current main.
//   BASE_URL=http://127.0.0.1:3000 node e2e/submission.immutability.mjs
// Batch-10 immutability drive: the filed record's HTTP surface.
import { chromium } from "playwright";
import { signIn, makeReady } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 140)));

await signIn(page, BASE);

// --- Note 1: fill through the builder, file via API.
const draft1 = await makeReady(page, ctx, BASE);
check(Boolean(draft1), `builder draft filled to fileable (${draft1})`);
const file1 = await ctx.request.post(`${BASE}/api/drafts/${draft1}/submit`, { data: {} });
const file1Body = await file1.json().catch(() => ({}));
check(file1.ok(), `note files (${file1.status()} ${file1Body.ticket ?? file1Body.error ?? ""})`);
const subs1 = (await (await ctx.request.get(`${BASE}/api/submissions?limit=20`)).json()).submissions ?? [];
check(subs1.length === 1, `exactly one submission after filing (${subs1.length})`);
const subId = subs1[0]?.id;

// --- The frozen record has no mutation surface: 405 by construction.
for (const [method, url] of [
  ["patch", `${BASE}/api/submissions/${subId}`],
  ["delete", `${BASE}/api/submissions/${subId}`],
  ["post", `${BASE}/api/submissions`]
]) {
  const r = await ctx.request[method](url, { data: {} });
  check(r.status() === 405, `${method.toUpperCase()} ${url.replace(BASE, "")} -> ${r.status()} (no such surface)`);
}

// --- A filed draft cannot be deleted, and survives the attempt.
{
  const r = await ctx.request.delete(`${BASE}/api/drafts/${draft1}`);
  check(r.status() === 409, `DELETE filed draft -> ${r.status()}`);
  check((await ctx.request.get(`${BASE}/api/drafts/${draft1}`)).ok(), "the filed draft row survives the attempt");
}

// --- Rename does not reopen the filing gate; an office change does.
{
  const d = (await (await ctx.request.get(`${BASE}/api/drafts/${draft1}`)).json()).draft;
  const r1 = await ctx.request.patch(`${BASE}/api/drafts/${draft1}`, { data: { baseVersion: d.version, title: "Renamed after filing" } });
  check(r1.ok(), `title-only PATCH accepted (${r1.status()})`);
  const s1 = await ctx.request.post(`${BASE}/api/drafts/${draft1}/submit`, { data: {} });
  check(s1.status() === 409, `submit after rename still refused (${s1.status()}) — same content, no second ticket`);

  const d2 = (await (await ctx.request.get(`${BASE}/api/drafts/${draft1}`)).json()).draft;
  const newOffice = d2.officeId === "executive-park" ? "town-and-country" : "executive-park";
  const r2 = await ctx.request.patch(`${BASE}/api/drafts/${draft1}`, { data: { baseVersion: d2.version, officeId: newOffice } });
  check(r2.ok(), `office PATCH accepted (${r2.status()})`);
  const s2 = await ctx.request.post(`${BASE}/api/drafts/${draft1}/submit`, { data: {} });
  const s2body = await s2.json().catch(() => ({}));
  check(s2.ok(), `office change reopens the gate — second ticket filed (${s2.status()} ${s2body.ticket ?? s2body.error ?? ""})`);
  const subs2 = (await (await ctx.request.get(`${BASE}/api/submissions?limit=20`)).json()).submissions ?? [];
  check(subs2.length === 2, `two submissions after the office change (${subs2.length})`);
}

// --- Double-submit race on a fresh ready note: exactly one wins.
const draft2 = await makeReady(page, ctx, BASE);
check(Boolean(draft2) && draft2 !== draft1, `second draft ready (${draft2})`);
{
  const [a, b] = await Promise.all([
    ctx.request.post(`${BASE}/api/drafts/${draft2}/submit`, { data: {} }),
    ctx.request.post(`${BASE}/api/drafts/${draft2}/submit`, { data: {} })
  ]);
  const statuses = [a.status(), b.status()].sort();
  check(statuses[0] === 200 && statuses[1] === 409, `double-submit race: one 200, one 409 (got ${statuses.join(", ")})`);
  const subs3 = (await (await ctx.request.get(`${BASE}/api/submissions?limit=20`)).json()).submissions ?? [];
  check(subs3.length === 3, `exactly one submission from the race (${subs3.length} total)`);
  const winner = a.status() === 200 ? await a.json() : await b.json();
  check(Boolean(winner.ticket), `the winner carries a ticket (${winner.ticket})`);
  const frozen = (await (await ctx.request.get(`${BASE}/api/submissions/${subs3[0].id}`)).json()).submission;
  check(Boolean(frozen?.noteMarkdown?.length), "the frozen note body committed with the shell (no half-filed record)");
}

// --- Recipient poka-yoke: refused loudly, case-insensitively.
{
  const fresh = await ctx.request.post(`${BASE}/api/drafts`, { data: { note: { selectedModuleIds: ["universal-core"], values: {} } } });
  const freshId = (await fresh.json()).draft?.id ?? (await (await ctx.request.get(`${BASE}/api/drafts`)).json()).drafts[0].id;
  const r = await ctx.request.post(`${BASE}/api/drafts/${freshId}/submit`, { data: { To: "attacker@evil.example" } });
  const msg = (await r.json().catch(() => ({}))).error ?? "";
  check(r.status() === 400 && /never accepts a recipient/.test(msg), `recipient key refused loudly (${r.status()})`);
}

console.log(errs.length ? "console errors: " + errs.join(" | ") : "no console errors");
await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll immutability checks passed.");
