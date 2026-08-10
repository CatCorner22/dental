// Write a clinician's whole day through the app's own HTTP surface, so the
// durability check reads back exactly what production would have stored.
// Prints TICKET=… and DRAFT=… for the verify step. See postgres-durability.sh.
import { chromium } from "playwright";
import { signIn, makeReady } from "../e2e/_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await signIn(page, BASE);

// A second account, so the restart has a user row that was NOT seeded at boot.
const mk = await ctx.request.post(`${BASE}/api/admin/users`, {
  data: {
    username: "durable1",
    displayName: "Durable One",
    role: "user",
    password: "durable1-pass-12345"
  }
});
if (!mk.ok() && mk.status() !== 409) throw new Error(`user create failed ${mk.status()}`);

const draft = await makeReady(page, ctx, BASE);
if (!draft) throw new Error("could not fill a note to fileable");
const d = (await (await ctx.request.get(`${BASE}/api/drafts/${draft}`)).json()).draft;
await ctx.request.patch(`${BASE}/api/drafts/${draft}`, {
  data: { baseVersion: d.version, title: "Durability Check Visit" }
});
const filed = await ctx.request.post(`${BASE}/api/drafts/${draft}/submit`, { data: { format: "md" } });
const body = await filed.json();
if (!filed.ok()) throw new Error(`submit failed ${filed.status()} ${JSON.stringify(body)}`);

// A second draft left OPEN, so the restart has unfinished work to preserve too.
const open = await ctx.request.post(`${BASE}/api/drafts`, {
  data: { note: { selectedModuleIds: ["universal-core"], values: {} } }
});
const openId = (await open.json()).draft?.id ?? "";

console.log(`TICKET=${body.ticket}`);
console.log(`DRAFT=${openId}`);
console.log(`FILED_DRAFT=${draft}`);
await browser.close();
