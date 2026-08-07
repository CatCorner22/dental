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
    // Next.js soft-recovers when a client RSC prefetch fails mid-navigation
    // ("Failed to fetch RSC payload … Falling back to browser navigation").
    // WebKit on phone hits this under rapid sequential gotos; Chromium/Firefox
    // usually do not. It is not an app bug — the fallback navigation completes
    // — so do not fail the smoke suite on it.
    //
    // The same engine also throws pageerrors for RSC prefetch fetches that are
    // blocked by the Cross-Origin-Resource-Policy header ("Fetch API cannot
    // load … due to access control checks"). These happen when viewport-based
    // link prefetch fires mid-rapid-navigation in WebKit on a narrow viewport;
    // the navigation itself succeeds via the fallback path. Filter both forms.
    const isBenignRscFallback = (t) =>
      /Failed to fetch RSC payload/i.test(t) && /Falling back to browser navigation/i.test(t);
    const isBenignRscCorpError = (t) =>
      /Fetch API cannot load/i.test(t) && /[?&]_rsc=/.test(t) && /access control checks/i.test(t);
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text().slice(0, 200);
      if (isBenignRscFallback(text)) return;
      consoleErrors.push(text);
    });
    page.on("pageerror", (e) => {
      const text = String(e).slice(0, 300);
      if (isBenignRscCorpError(text)) return;
      consoleErrors.push("PAGEERROR: " + text.slice(0, 200));
    });

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
        // Acknowledging the notice is what calls markApiReady(), which releases
        // the two fetches deferred behind it — BuilderShell's practice-packs
        // load and the SuperByte deployment probe (see src/lib/client/apiReady.ts).
        // They are therefore in flight at exactly this moment, and if the next
        // goto() tears the document down first, WebKit reports the aborted
        // request as "Fetch API cannot load … due to access control checks"
        // rather than as an abort — because next.config.mjs sets
        // Cross-Origin-Resource-Policy: same-origin and CORP gets evaluated
        // against a document that is going away.
        //
        // That is the same engine behaviour isBenignRscCorpError already
        // filters for Next's own prefetches; that filter requires `_rsc=` in
        // the URL, so it does not cover these two app routes, and it should not
        // be widened to — a blanket filter on that message would also swallow a
        // real 403 regression, which is precisely what this assertion exists to
        // catch. Wait for the requests to settle instead of hiding their
        // failure. Observed as an intermittent webkit/desktop failure; the
        // fixed 600ms above is not enough on a loaded runner.
        await page.waitForLoadState("networkidle");
      }

      // Feedback reminder: present, with a here-link that emails the developer.
      const fb = page.getByRole("dialog").filter({ hasText: "Send feedback" });
      check((await fb.count()) > 0, `${tag}: feedback dialog shown on login`);
      if (await fb.count()) {
        const here = fb.getByRole("link", { name: "here" });
        const href = (await here.count()) ? await here.getAttribute("href") : "";
        check(!!href && href.includes(`mailto:${FEEDBACK_EMAIL}`), `${tag}: "here" emails ${FEEDBACK_EMAIL}`);
        // DISMISS BY ROLE, NOT BY ONE EXACT WORD.
        //
        // This clicked "Got it" and the button had been renamed "Not now", so
        // every browser and both viewports timed out here — six identical
        // failures, thirty seconds each, and the run never reached the
        // assertions this file exists for: no horizontal overflow, no console
        // errors, every route reachable. A smoke test that dies on the copy of
        // a dismiss button is a smoke test that stops smoke-testing.
        //
        // The alternation keeps it working across a rename in either
        // direction. What is actually being asserted is that the dialog HAS a
        // way out and that pressing it closes the thing.
        const dismiss = fb.getByRole("button", { name: /Not now|Got it|Dismiss/i });
        check((await dismiss.count()) > 0, `${tag}: feedback dialog can be dismissed`);
        if (await dismiss.count()) {
          await dismiss.first().click();
          await page.waitForTimeout(300);
        }
        check((await fb.count()) === 0, `${tag}: feedback dialog closes and stays closed`);
      }

      // No horizontal overflow on the main pages.
      for (const path of ["/", "/notes", "/notes?tab=filed", "/notes/batch", "/reference", "/standardize", "/wishes", "/store", "/training"]) {
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
