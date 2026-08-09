// Time-to-first-action probe for the homepage note builder.
//
// Batch-12 reference numbers (localhost, warm server, median of 5):
//   baseline 445 ms -> 344 ms after splitting click-only panels -> 317 ms after
//   the audit engine left the first-paint path (908 -> 786 KB initial JS).
// Re-run after changes that touch BuilderShell's import graph; a jump back
// toward the baseline means something re-chained heavy code onto first load.
//
// Requires a freshly-booted or warm server with the smoke admin.
// Headline metric: from starting navigation to `/` (signed in) until a typed
// character PERSISTS in the subjective textarea — i.e., the field exists, is
// interactable, and hydration no longer wipes input. Also collects the standard
// paint/navigation timings and a payload breakdown so the dominant cost is
// attributable (server vs network vs client).
//
// Usage: BASE_URL=http://127.0.0.1:3000 node e2e/ttfa.mjs
import { chromium } from "playwright";
import { signIn, dismiss } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const RUNS = 5;

const browser = await chromium.launch();

// LCP needs an observer registered before the page's own scripts run.
const LCP_SNOOP = `
  window.__lcp = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lcp = Math.max(window.__lcp, e.startTime);
  }).observe({ type: "largest-contentful-paint", buffered: true });
`;

async function timings(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)])
    );
    const res = performance.getEntriesByType("resource");
    const byType = {};
    for (const r of res) {
      const t = r.initiatorType === "script" ? "js"
        : /\.css/.test(r.name) ? "css"
        : /font|woff/.test(r.name + r.initiatorType) ? "font"
        : r.initiatorType;
      byType[t] = byType[t] ?? { n: 0, kb: 0 };
      byType[t].n++;
      byType[t].kb += (r.transferSize || r.encodedBodySize || 0) / 1024;
    }
    for (const k of Object.keys(byType)) byType[k].kb = Math.round(byType[k].kb);
    return {
      ttfb: Math.round(nav.responseStart),
      htmlKb: Math.round((nav.transferSize || nav.encodedBodySize || 0) / 1024),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      fcp: paints["first-contentful-paint"] ?? null,
      lcp: Math.round(window.__lcp),
      byType
    };
  });
}

// Type until a character persists (hydration can wipe pre-hydration input).
// Returns ms from navStart until the char is verified present.
async function timeToFirstKeystroke(page, t0) {
  const sel = 'textarea[id*="subjective"]';
  await page.waitForSelector(sel, { state: "visible", timeout: 30000 });
  for (;;) {
    try {
      await page.click(sel, { timeout: 2000 });
      await page.type(sel, "q", { timeout: 2000 });
    } catch { /* not interactable yet */ }
    await page.waitForTimeout(40);
    const v = await page.inputValue(sel).catch(() => "");
    if (v.includes("q")) {
      const t = Date.now() - t0;
      // clean up so the next run starts from an empty field
      await page.fill(sel, "").catch(() => {});
      return t;
    }
  }
}

const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// --- signed-in context; ack the notice once so steady-state runs are dialog-free
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(LCP_SNOOP);
const page = await ctx.newPage();

// First-visit path: measure the dialog cost once, on the very first load.
const tFirst0 = Date.now();
await signIn(page, BASE); // lands on / — dialog present on first visit
const dlgVisibleAt = Date.now() - tFirst0;
await dismiss(page);
const firstKeystroke = await timeToFirstKeystroke(page, tFirst0);
console.log(`first-visit: signin+load+dialog visible ~${dlgVisibleAt}ms; first keystroke (incl. sign-in + ack) ${firstKeystroke}ms`);

// Warm-up load (route now compiled/cached server-side), then measured runs.
await page.goto(`${BASE}/`, { waitUntil: "load" });
await dismiss(page);

const rows = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "commit" });
  const ttfa = await timeToFirstKeystroke(page, t0);
  await page.waitForLoadState("load");
  const t = await timings(page);
  rows.push({ ttfa, ...t });
}

console.log("\nrun  ttfa  ttfb  fcp   lcp   dcl   load  htmlKb");
rows.forEach((r, i) =>
  console.log(
    `${String(i + 1).padEnd(4)} ${String(r.ttfa).padEnd(5)} ${String(r.ttfb).padEnd(5)} ${String(r.fcp).padEnd(5)} ${String(r.lcp).padEnd(5)} ${String(r.domContentLoaded).padEnd(5)} ${String(r.load).padEnd(5)} ${r.htmlKb}`
  )
);
console.log("\nMEDIANS");
console.log(`  time-to-first-keystroke : ${med(rows.map((r) => r.ttfa))} ms`);
console.log(`  TTFB                    : ${med(rows.map((r) => r.ttfb))} ms`);
console.log(`  FCP                     : ${med(rows.map((r) => r.fcp))} ms`);
console.log(`  LCP                     : ${med(rows.map((r) => r.lcp))} ms`);
console.log(`  DOMContentLoaded        : ${med(rows.map((r) => r.domContentLoaded))} ms`);
console.log(`  load                    : ${med(rows.map((r) => r.load))} ms`);
console.log(`  HTML transfer           : ${med(rows.map((r) => r.htmlKb))} KB`);
const last = rows[rows.length - 1].byType;
console.log("  payload by type (last run):", JSON.stringify(last));

await browser.close();
