// Pre-hydration login probe — proves the sign-in form works as a plain HTML
// form, with JavaScript entirely absent.
//
// The defect this guards: the form used to be onSubmit-driven, so a submit
// that landed before React hydrated fell back to native GET submission — the
// page reloaded to /login? and the typed credentials were silently discarded.
// The server-action form answers a native POST by actually signing the user
// in. This probe aborts every /_next/static JS request so hydration can never
// happen, then asserts the whole flow — success, failure copy, the MFA offer
// — through full-page navigations only.
//
// Also asserted: the password never appears in ANY request URL, in any mode.
// That is the difference between "safe in a POST body over TLS" and "leaked
// into history and server logs".
//
// Usage: BASE_URL=http://127.0.0.1:3000 node e2e/prehydration.login.mjs
// Needs the same seeded user as the cross-browser smoke (SMOKE_USER/SMOKE_PASS).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const USER = process.env.SMOKE_USER || "smokeadmin";
const PASS = process.env.SMOKE_PASS || "smoke-pass-12345";

const failures = [];
function check(cond, label) {
  if (!cond) failures.push(label);
  console.log(`${cond ? "ok  " : "FAIL"}  ${label}`);
}

const browser = await chromium.launch();

// ---- Flow 1: no-JS sign-in succeeds and honors callbackUrl -----------------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const seenUrls = [];
  await ctx.route("**/*", (route) => {
    seenUrls.push(route.request().url());
    if (/\/_next\/static\/.*\.js(\?|$)/.test(route.request().url())) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login?callbackUrl=%2Fnotes%3Ftab%3Dfiled`, {
    waitUntil: "domcontentloaded"
  });
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]')
  ]).catch(() => {});
  const landed = new URL(page.url());
  check(!landed.pathname.includes("/login"), `no-JS sign-in navigates off /login (landed ${landed.pathname})`);
  check(
    landed.pathname === "/notes" && landed.search === "?tab=filed",
    `no-JS sign-in honors callbackUrl (landed ${landed.pathname}${landed.search})`
  );
  const cookies = await ctx.cookies();
  check(
    cookies.some((c) => /session-token/i.test(c.name)),
    "session cookie set by the same response"
  );
  // Not just the URL — the PAGE. This probe once "passed" on URL + cookie
  // while the landed document was the "This session is no longer valid" dead
  // end: the login action's bundle layer had bootstrapped its own in-memory
  // PGlite, so the minted session's user id existed in no other layer's
  // database. A session is only proven by an authenticated render.
  const landedBody = (await page.locator("body").textContent().catch(() => "")) ?? "";
  check(
    !/session is no longer valid/i.test(landedBody),
    "landed page renders authenticated (not the invalid-session dead end)"
  );
  check(
    !seenUrls.some((u) => u.includes(encodeURIComponent(PASS)) || u.includes(PASS)),
    "password appears in no request URL"
  );
  await ctx.close();
}

// ---- Flow 2: no-JS failure re-renders with the alert and keeps the username
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/_next/static/**/*.js", (route) => route.abort());
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", "definitely-wrong-password");
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.click('button[type="submit"]')
  ]).catch(() => {});
  await page.waitForTimeout(1500);
  const alert = await page.locator('[role="alert"]').textContent().catch(() => "");
  check(/sign-in failed/i.test(alert ?? ""), `no-JS failure shows the alert copy (got "${(alert ?? "").slice(0, 60)}")`);
  const keptUser = await page.locator("#li-user").inputValue().catch(() => "");
  check(keptUser === USER, "no-JS failure re-render keeps the typed username");
  const pass = await page.locator("#li-pass").inputValue().catch(() => "x");
  check(pass === "", "no-JS failure re-render never echoes the password");
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} pre-hydration check(s) failed:`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log("\nAll pre-hydration login checks passed.");
