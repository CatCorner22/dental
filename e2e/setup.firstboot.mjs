// Batch-10 first-boot /setup drive. Needs its OWN server, booted with NO
// ADMIN_USERNAME/ADMIN_PASSWORD and an empty in-memory DB, on :3101.
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3101";
const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 120)));

// With an empty DB and no seed env, the app boots and any route sends you to
// /setup (there is no admin to sign in as yet).
{
  const r = await ctx.request.get(`${BASE}/api/setup`);
  // GET is not exported → 405; what matters is the server booted at all.
  check(r.status() === 405 || r.status() === 404, `server booted with no seed env (GET /api/setup -> ${r.status()})`);
}
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check(/\/(setup|login)/.test(new URL(page.url()).pathname), `empty-DB root redirects to onboarding (landed ${new URL(page.url()).pathname})`);

// Create the first admin through the real SetupForm.
await page.goto(`${BASE}/setup`, { waitUntil: "networkidle" });
check((await page.locator("form").count()) > 0, "the setup form renders on an empty deployment");
// Hydration guard: the submit button waits for hydration.
await page.waitForFunction(() => {
  const f = document.querySelector("form");
  return f && Object.keys(f).some((k) => k.startsWith("__reactFiber"));
});
await page.fill("#su-user", "founder");
await page.fill("#su-name", "Founding Admin");
await page.fill("#su-pass", "founder-pass-12345");
await page.fill("#su-confirm", "founder-pass-12345");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/setup"), { timeout: 20000 }).catch(() => {}),
  page.getByRole("button", { name: "Create admin & sign in" }).click()
]);
await page.waitForTimeout(2000);
const landed = new URL(page.url()).pathname;
check(!landed.includes("/setup"), `first admin created and signed in (landed ${landed})`);

// The lock: /setup now redirects away and POST /api/setup 409s.
await page.goto(`${BASE}/setup`, { waitUntil: "networkidle" });
check(new URL(page.url()).pathname !== "/setup", `/setup now redirects away (landed ${new URL(page.url()).pathname})`);
{
  const r = await ctx.request.post(`${BASE}/api/setup`, { data: { username: "second", password: "second-pass-12345" } });
  const msg = (await r.json().catch(() => ({}))).error ?? "";
  check(r.status() === 409, `POST /api/setup is locked after the first admin (${r.status()}: ${msg.slice(0, 40)})`);
}
// And the founder can actually sign in.
{
  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await p2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p2.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__reactFiber")); });
  await p2.fill("#li-user", "founder");
  await p2.fill("#li-pass", "founder-pass-12345");
  await Promise.all([p2.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => {}), p2.click('button[type="submit"]')]);
  check(!new URL(p2.url()).pathname.includes("/login"), "the created founder can sign in");
  await c2.close();
}

const netErrs = errs.filter((e) => !/403|feedback/i.test(e));
console.log(netErrs.length ? "console errors: " + netErrs.join(" | ") : "no console errors");
await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll first-boot /setup checks passed.");
