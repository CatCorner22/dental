// Login lockout drive. The pair throttle (ip+username: 5 free, then a 15s
// doubling lock) and the IP spray detector (30 free across ANY usernames,
// then ONE auth.spray row per window, detector-only) — driven through the
// real login form, including the lock LAPSING (the self-renewing-lock
// regression) and the auth.lockout audit row the lock transition writes.
// Runtime ~2 min (includes a real 16.5s lock wait and ~38 form logins).
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin.
//   BASE_URL=http://127.0.0.1:3000 node e2e/lockout.mjs
import { chromium } from "playwright";
import { signIn, dismiss } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();

// One login attempt through the real form; returns the visible outcome text.
async function attempt(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('button[type="submit"]')
  ]);
  await page.waitForTimeout(400);
  if (!page.url().includes("/login")) return "signed-in";
  return ((await page.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
}

// Seed a victim account via the admin.
{
  const actx = await browser.newContext();
  const ap = await actx.newPage();
  await signIn(ap, BASE);
  await actx.request.post(`${BASE}/api/admin/users`, {
    data: { username: "lockme1", displayName: "Lock Me", role: "user", password: "lockme1-pass-12345" }
  });
  await actx.close();
}

// ---- Pair lock: 5 free failures, the 6th locks, the lock lapses ------------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (let i = 1; i <= 5; i++) await attempt(page, "lockme1", "wrong-password-x");
  // Attempt 6: even the CORRECT password must now be refused — the lock is on
  // the pair, not on the wrongness of the password.
  const locked = await attempt(page, "lockme1", "lockme1-pass-12345");
  check(locked !== "signed-in", "6th attempt is locked even with the CORRECT password");
  check(/locked|too many|try again/i.test(locked), `the refusal names the lock [${locked.slice(0, 380).match(/[^.]*(locked|too many|try again)[^.]*/i)?.[0]?.trim().slice(0, 80) ?? "?"}]`);

  // First lock is 15s (doubling starts there). Wait it out; the correct
  // password must then work — a lock that renews itself on every attempt
  // would never lapse (the regression the unit tests pin).
  await page.waitForTimeout(16_500);
  const after = await attempt(page, "lockme1", "lockme1-pass-12345");
  check(after === "signed-in", "after the lock lapses, the correct password signs in");
  // A signed-in session's mandatory notice overlays every page including
  // /login — the remaining phases use their own fresh contexts.
  await ctx.close();
}

// ---- IP spray detector: never a gate, exactly one audit row ----------------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // 31+ failures across DISTINCT usernames from one address. The pair throttle
  // never engages (each pair sees one failure); the IP meter crosses 30.
  for (let i = 1; i <= 32; i++) {
    await attempt(page, `ghost${String(i).padStart(3, "0")}`, "nope-nope-nope");
  }
  // The detector must not have become a gate: a legitimate sign-in from the
  // same address still works.
  const still = await attempt(page, "lockme1", "lockme1-pass-12345");
  check(still === "signed-in", "after the spray, a legitimate sign-in from the same address still works");
  await ctx.close();

  const actx = await browser.newContext();
  const ap = await actx.newPage();
  await signIn(ap, BASE);
  await ap.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  await dismiss(ap);
  const audit = ((await ap.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
  const sprayRows = (audit.match(/Many failed sign-ins from one address/g) ?? []).length;
  check(sprayRows === 1, `exactly one auth.spray row per window (${sprayRows})`);
  check(/Failed sign-in/.test(audit), "failed sign-ins are individually audited");
  // The lock transition itself is audited, once, naming the real account —
  // the row the audit page had a label for that nothing ever wrote.
  const lockRows = (audit.match(/Sign-in locked \(too many attempts\)/g) ?? []).length;
  check(lockRows === 1 && /lockme1/.test(audit), `the pair lock landed exactly one auth.lockout row naming the account (${lockRows})`);
  await actx.close();
}

await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll lockout checks passed.");
