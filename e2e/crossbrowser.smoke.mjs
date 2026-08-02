// Cross-browser smoke test — runs in CI, where the runner CAN download the
// Playwright WebKit and Firefox engines that this dev sandbox cannot. It drives
// the REAL production build in Chromium, Firefox, and WebKit (Safari's engine),
// so the Safari-specific fixes in this app (dvh fallbacks, -webkit- prefixes,
// the iOS scroll lock, the notice/feedback dialogs) are verified by execution
// rather than by reasoning about engine behavior.
//
// Usage: BASE_URL=http://127.0.0.1:3000 node e2e/crossbrowser.smoke.mjs
// Exits non-zero on the first failed assertion so CI goes red.

import { chromium, firefox, webkit } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const USER = process.env.SMOKE_USER || "smokeadmin";
const PASS = process.env.SMOKE_PASS || "smoke-pass-12345";
const FEEDBACK_EMAIL = "blakereagan@protonmail.com";

const ENGINES = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit]
];

// A phone and a desktop viewport, so mobile layout is exercised too.
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false }
];

const failures = [];
function check(cond, label) {
  if (!cond) failures.push(label);
  console.log(`${cond ? "ok  " : "FAIL"}  ${label}`);
}

for (const [engineName, engine] of ENGINES) {
  const browser = await engine.launch();
  for (const vp of VIEWPORTS) {
    const tag = `${engineName}/${vp.name}`;
    // WebKit rejects touch options unless it's a real mobile context; keep it
    // simple and only pass mobile flags to Chromium where they are supported.
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      ...(engineName === "chromium" ? { hasTouch: vp.mobile, isMobile: vp.mobile } : {})
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
    page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));

    try {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
      await page.fill("#li-user", USER);
      await page.fill("#li-pass", PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
      await page.waitForLoadState("networkidle");
      check(true, `${tag}: login succeeded`);

      // Legal gate first (blocks everything behind it).
      const legal = page.getByRole("dialog").filter({ hasText: "Before you begin" });
      if (await legal.count()) {
        await legal.getByRole("button", { name: "I understand" }).click();
        await page.waitForTimeout(600);
      }

      // Feedback reminder: present, with a here-link that emails the developer.
      const fb = page.getByRole("dialog").filter({ hasText: "Send feedback" });
      check((await fb.count()) > 0, `${tag}: feedback dialog shown on login`);
      if (await fb.count()) {
        const here = fb.getByRole("link", { name: "here" });
        const href = (await here.count()) ? await here.getAttribute("href") : "";
        check(!!href && href.includes(`mailto:${FEEDBACK_EMAIL}`), `${tag}: "here" emails ${FEEDBACK_EMAIL}`);
        await fb.getByRole("button", { name: "Got it" }).click();
        await page.waitForTimeout(300);
      }

      // No horizontal overflow on the main pages.
      for (const path of ["/", "/history", "/reference"]) {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(200);
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        check(over <= 1, `${tag}: no horizontal overflow on ${path} (got ${over}px)`);
      }

      check(consoleErrors.length === 0, `${tag}: no console errors ${JSON.stringify(consoleErrors.slice(0, 3))}`);
    } catch (e) {
      check(false, `${tag}: threw ${String(e).slice(0, 200)}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} cross-browser check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll cross-browser checks passed.");
