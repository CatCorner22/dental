// Batch-10 exports + AI-off-state drive. Runs against a server that already
// has filed submissions + the admin user (e.g. right after the immutability
// drive). Verifies the CSV export contract through the real pipeline and the
// AI layer's dev off-state.
import { chromium } from "playwright";
import { signIn } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await signIn(page, BASE);

// --- Mint a Team Member for the role-floor checks, and a user whose display
//     name is a CSV formula-injection payload.
const mk = (u, r, extra = {}) => ctx.request.post(`${BASE}/api/admin/users`, { data: { username: u, displayName: extra.displayName ?? u, role: r, password: `${u}-pass-12345`, ...extra } });
await mk("exp-user", "user", { email: "exp-user@example.com" });
// Set an existing user's display name to a formula-injection payload via PATCH.
const users = (await (await ctx.request.get(`${BASE}/api/admin/users`)).json()).users;
const target = users.find((u) => u.username === "exp-user");
{
  const d = target;
  const r = await ctx.request.patch(`${BASE}/api/admin/users/${d.id}`, { data: { displayName: '=HYPERLINK("http://evil","x")' } });
  check(r.ok(), `display name set to a formula payload (${r.status()})`);
}

// --- users export: BOM, formula neutralization, and it is a real CSV.
{
  const r = await ctx.request.get(`${BASE}/api/export/users`);
  check(r.ok(), `admin downloads users export (${r.status()})`);
  const body = await r.text();
  check(body.charCodeAt(0) === 0xfeff, "users CSV carries a UTF-8 BOM");
  // The payload cell must be neutralized: a leading apostrophe INSIDE the quoted field.
  check(/"'=HYPERLINK/.test(body), "the =HYPERLINK payload is neutralized with a leading apostrophe inside quotes");
  check(!/^=HYPERLINK/m.test(body), "no cell begins a formula unescaped");
  const cd = r.headers()["content-disposition"] || "";
  check(/attachment/.test(cd), "served as an attachment");
}

// --- role floors: a Team Member is refused users and audit-log exports.
{
  const uctx = await browser.newContext();
  const up = await uctx.newPage();
  await signIn(up, BASE, "exp-user", "exp-user-pass-12345");
  const u = await uctx.request.get(`${BASE}/api/export/users`);
  check(u.status() === 403, `Team Member refused users export (${u.status()})`);
  const a = await uctx.request.get(`${BASE}/api/export/audit-log`);
  check(a.status() === 403, `Team Member refused audit-log export (${a.status()})`);
  await uctx.close();
}

// --- the export.csv audit row lands with a row count.
{
  await ctx.request.get(`${BASE}/api/export/wishes`);
  const audit = await (await ctx.request.get(`${BASE}/api/export/audit-log`)).text();
  check(/export\.csv|Data export/i.test(audit), "export.csv is recorded in the audit log");
}

// --- AI off-state: no key in dev.
{
  const assist = await ctx.request.post(`${BASE}/api/assist`, { data: { capability: "normalize", text: "pt c/o pain" } });
  check(assist.status() === 503, `/api/assist is 503 when AI is off (${assist.status()})`);
  const bs = await ctx.request.get(`${BASE}/api/bytestar`);
  const bsBody = await bs.json().catch(() => ({}));
  check(bs.ok() && bsBody.enabled === false, `/api/bytestar reports disabled (${bs.status()} enabled=${bsBody.enabled})`);
}

// --- SuperByte panel renders deterministic instrument observations, no console errors.
{
  const errs = [];
  const sp = await ctx.newPage();
  sp.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
  sp.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 120)));
  await sp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  for (const [t, n] of [["Before you begin", /i understand/i], ["Send feedback", /not now|got it|dismiss/i]]) {
    const d = sp.getByRole("dialog").filter({ hasText: t });
    if (await d.count()) { const b = d.getByRole("button", { name: n }); if (await b.count()) await b.first().click().catch(() => {}); await sp.waitForTimeout(300); }
  }
  const superbyte = sp.locator("#advisor-superbyte, [aria-label='SuperByte observational pioneer']");
  check((await superbyte.count()) > 0, "the SuperByte panel renders with AI off");
  const netErrs = errs.filter((e) => !/403|bytestar|feedback/i.test(e));
  check(netErrs.length === 0, `SuperByte off-state has no unexpected console errors [${netErrs.join(" | ")}]`);
  await sp.close();
}

await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll export + AI-off-state checks passed.");
