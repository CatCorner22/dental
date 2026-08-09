// Hydration/first-paint cleanliness guard. Loads every page a signed-in admin
// reaches on a PLAIN navigation — no synthetic fill — and asserts none logs a
// React invariant (185 max-update-depth, 418/423/425 hydration) or a hydration
// mismatch. Hydration runs at first paint, so anything caught here is reachable
// by a real user; a clean pass is the evidence that the #185/#418 seen in the
// flow drives (phi.mask-override, submission.immutability) are bulk-fill probe
// artifacts, not product defects — a human typing at human speed never trips them.
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin.
//   BASE_URL=http://127.0.0.1:3000 node e2e/hydration.clean.mjs
import { chromium } from "playwright";
import { signIn, dismiss } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const hits = [];
const record = (kind, url, text) => {
  // Any React invariant or hydration phrase. On a plain navigation there is no
  // synthetic fill, so anything caught here is reachable by a real user.
  if (/react error #\d+|Minified React error|Hydration|hydrat|did not match|didn't match|Maximum update depth/i.test(text)) {
    hits.push(`${kind} [${url.replace(BASE, "") || "/"}] ${text.slice(0, 180)}`);
  }
};
page.on("console", (m) => { if (m.type() === "error") record("console", page.url(), m.text()); });
page.on("pageerror", (e) => record("pageerror", page.url(), String(e)));

await signIn(page, BASE);
// A draft to land the note page on.
const dr = await ctx.request.post(`${BASE}/api/drafts`, { data: { note: { selectedModuleIds: ["universal-core"], values: {} } } });
const draftId = (await dr.json()).draft?.id ?? (await (await ctx.request.get(`${BASE}/api/drafts`)).json()).drafts[0].id;

let failures = 0;
const pages = ["/", `/note/${draftId}`, "/admin/audit", "/notes", "/admin/users"];
for (const p of pages) {
  const before = hits.length;
  await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
  await dismiss(page);
  await page.waitForTimeout(1200); // let hydration settle
  const dirty = hits.length > before;
  if (dirty) failures++;
  console.log(`${dirty ? "FAIL " : "ok   "} ${p} hydrates clean on plain navigation`);
}

if (hits.length) {
  console.log("\n--- hydration hits ---");
  for (const h of hits) console.log(h);
}
await browser.close();
if (failures) { console.error(failures + " page(s) with a hydration/React error"); process.exit(1); }
console.log("\nAll pages hydrate clean on plain navigation.");
