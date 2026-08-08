// TOTP second-factor probe — drives the entire MFA lifecycle against a real
// server: enrollment through the /account UI, a hydrated login where the
// password-only attempt fails and the code retry signs in, the same flow with
// JavaScript entirely absent, the no-oracle negatives, and code-gated disable.
//
// The properties this pins, none of which a unit test can reach:
//   - enrollment start→confirm actually arms the factor the login path checks
//     (one shared database across bundle layers — the batch-6 lesson);
//   - a password-only failure OFFERS the code field but the copy never says
//     whether the account is enrolled, and an unknown account fails with the
//     byte-identical copy and offer (no oracle);
//   - the no-JS MPA path carries the whole flow — failure re-render with the
//     code field, then a native POST with a code that lands the deep link;
//   - wrong code costs the same generic failure as a wrong password;
//   - disable requires a current code, after which password-only works again.
//
// The probe leaves the account exactly as it found it (MFA off).
//
// Usage: needs a server started with MFA_ENABLED=1 (plus the usual smoke env);
// without the flag the /account card does not render and this exits early
// with a clear message. Codes are generated with the repo's own `otpauth`
// dependency — TOTP output depends only on secret + time + SHA1/6/30, so the
// driver matches src/lib/auth/totp.ts without importing TypeScript.
//
//   BASE_URL=http://127.0.0.1:3000 node e2e/mfa.totp.mjs
import { chromium } from "playwright";
import { Secret, TOTP } from "otpauth";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const USER = process.env.SMOKE_USER || "smokeadmin";
const PASS = process.env.SMOKE_PASS || "smoke-pass-12345";

const failures = [];
function check(cond, label) {
  if (!cond) failures.push(label);
  console.log(`${cond ? "ok  " : "FAIL"}  ${label}`);
}
const codeFor = (secret) =>
  new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate();

// The exact copy from loginFailureMessage() — asserted verbatim because the
// no-oracle property lives in these strings being independent of enrollment.
const FIRST_FAIL_COPY =
  "Sign-in failed. If this account uses an authenticator app, enter the current code below.";
const OFFERED_FAIL_COPY =
  "Sign-in failed. Check the username, password, and authenticator code.";

const browser = await chromium.launch();
const errs = [];
const hookErrors = (page, tag) => {
  page.on("pageerror", (e) => errs.push(`${tag} PAGEERROR ${String(e).slice(0, 140)}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`${tag} ${m.text().slice(0, 140)}`); });
};
const dismiss = async (page) => {
  const fb = page.getByRole("dialog").filter({ hasText: "Send feedback" });
  if (await fb.count()) {
    const d = fb.getByRole("button", { name: /not now|got it|dismiss/i });
    if (await d.count()) await d.first().click().catch(() => {});
    await fb.first().waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
};
const hydrated = (page) =>
  page.waitForFunction(() => {
    const f = document.querySelector("form");
    return f && Object.keys(f).some((k) => k.startsWith("__reactFiber"));
  });
const alertText = async (page) => {
  // Next's route announcer is an always-present empty alert; take the one with text.
  const texts = await page.locator('[role="alert"]').allTextContents();
  return (texts.find((t) => t.trim()) ?? "").trim();
};
const signIn = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]')
  ]);
  await page.waitForLoadState("networkidle");
  await dismiss(page);
};

// ---- 1. Enroll through the real /account UI --------------------------------
let secret = "";
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  hookErrors(page, "enroll");
  await signIn(page);
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await dismiss(page);
  const setup = page.getByRole("button", { name: "Set up two-factor authentication" });
  if ((await setup.count()) === 0) {
    console.error("No MFA setup card on /account — start the server with MFA_ENABLED=1.");
    await browser.close();
    process.exit(2);
  }
  await setup.click();
  const secretEl = page.locator("p.font-mono");
  await secretEl.waitFor({ timeout: 10000 });
  secret = ((await secretEl.textContent()) ?? "").trim();
  check(/^[A-Z2-7]{16,}$/.test(secret), "start returns a base32 secret");
  await page.fill("#mfa-code", codeFor(secret));
  await page.getByRole("button", { name: "Confirm and turn on" }).click();
  const notice = page.getByRole("status");
  await notice.waitFor({ timeout: 10000 });
  check(
    /two-factor authentication is on/i.test((await notice.textContent()) ?? ""),
    "confirm with a current code turns MFA on"
  );
  await ctx.close();
}

// ---- 2. Hydrated login: password-only fails generic, then code signs in ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const seenUrls = [];
  await ctx.route("**/*", (route) => {
    seenUrls.push(route.request().url());
    return route.continue();
  });
  const page = await ctx.newPage();
  hookErrors(page, "hydrated");
  await page.goto(
    `${BASE}/login?callbackUrl=${encodeURIComponent(`${BASE}/notes?tab=filed`)}`,
    { waitUntil: "networkidle" }
  );
  await hydrated(page);
  check((await page.locator("#li-totp").count()) === 0, "code field is not shown before any failure");
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", PASS);
  await page.click('button[type="submit"]');
  await page.locator("#li-totp").waitFor({ timeout: 15000 });
  check(true, "password-only failure OFFERS the code field");
  check((await alertText(page)) === FIRST_FAIL_COPY, "password-only failure uses the generic first-failure copy");
  check((await page.locator("#li-user").inputValue()) === USER, "failure keeps the typed username");
  // Designed contract (LoginForm.tsx): the password is CLIENT state — a
  // hydrated failure keeps it so the enrolled user adds only the code. The
  // never-echoed property is asserted on the no-JS path, where the render is
  // the server's.
  check(
    (await page.locator("#li-pass").inputValue()) === PASS,
    "hydrated failure keeps the client-held password (add-the-code UX)"
  );
  await page.fill("#li-totp", codeFor(secret));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]')
  ]);
  const landed = new URL(page.url());
  check(
    landed.pathname === "/notes" && landed.search === "?tab=filed",
    `code retry honors callbackUrl (landed ${landed.pathname}${landed.search})`
  );
  await page.waitForLoadState("networkidle");
  const body = (await page.locator("body").textContent().catch(() => "")) ?? "";
  check(!/session is no longer valid/i.test(body), "landed page renders authenticated");
  check(
    !seenUrls.some((u) => u.includes(PASS) || u.includes(secret)),
    "password and secret appear in no request URL"
  );
  await ctx.close();
}

// ---- 3. No-JS MPA login with a code ---------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/_next/static/**/*.js", (route) => route.abort());
  const page = await ctx.newPage();
  await page.goto(
    `${BASE}/login?callbackUrl=${encodeURIComponent(`${BASE}/notes?tab=filed`)}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", PASS);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.click('button[type="submit"]')
  ]).catch(() => {});
  await page.waitForTimeout(1500);
  check((await page.locator("#li-totp").count()) === 1, "no-JS failure re-render offers the code field");
  check((await alertText(page)) === FIRST_FAIL_COPY, "no-JS failure shows the same generic copy");
  check(
    (await page.locator("#li-pass").inputValue()) === "",
    "no-JS re-render never echoes the password (server-rendered HTML)"
  );
  await page.fill("#li-pass", PASS);
  await page.fill("#li-totp", codeFor(secret));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]')
  ]).catch(() => {});
  const landed = new URL(page.url());
  check(
    landed.pathname === "/notes" && landed.search === "?tab=filed",
    `no-JS code retry lands the deep link (landed ${landed.pathname}${landed.search})`
  );
  const cookies = await ctx.cookies();
  check(cookies.some((c) => /session-token/i.test(c.name)), "no-JS MFA sign-in sets the session cookie");
  const body = (await page.locator("body").textContent().catch(() => "")) ?? "";
  check(!/session is no longer valid/i.test(body), "no-JS landed page renders authenticated");
  await ctx.close();
}

// ---- 4. Negatives: wrong code, and the no-oracle property ------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  hookErrors(page, "negative");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", "definitely-wrong-password");
  await page.click('button[type="submit"]');
  await page.locator("#li-totp").waitFor({ timeout: 15000 });
  const wrongPassCopy = await alertText(page);
  await page.fill("#li-pass", PASS);
  await page.fill("#li-totp", "000000");
  await page.click('button[type="submit"]');
  await page
    .waitForFunction(
      (prev) => {
        const alerts = [...document.querySelectorAll('[role="alert"]')]
          .map((a) => a.textContent?.trim())
          .filter(Boolean);
        return alerts.length > 0 && alerts.every((t) => t !== prev);
      },
      wrongPassCopy,
      { timeout: 15000 }
    )
    .catch(() => {});
  await page.waitForTimeout(500);
  const wrongCodeCopy = await alertText(page);
  check(
    wrongCodeCopy === OFFERED_FAIL_COPY,
    `right password + wrong code fails with the offered-copy (got "${wrongCodeCopy.slice(0, 70)}")`
  );
  check(new URL(page.url()).pathname === "/login", "wrong code does not sign in");
  await ctx.close();
}
{
  // No oracle: an account that does not exist must fail with EXACTLY the same
  // copy and the same code-field offer as the enrolled account did.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill("#li-user", "no-such-user-mfa-probe");
  await page.fill("#li-pass", "whatever-password-1");
  await page.click('button[type="submit"]');
  await page.locator("#li-totp").waitFor({ timeout: 15000 });
  check(
    (await alertText(page)) === FIRST_FAIL_COPY,
    "unknown account fails with the identical copy and code offer (no enrollment oracle)"
  );
  await ctx.close();
}

// ---- 5. Disable with a current code, then password-only works again --------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  hookErrors(page, "disable");
  // The MFA login: password-only fails, add the code, land signed in.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill("#li-user", USER);
  await page.fill("#li-pass", PASS);
  await page.click('button[type="submit"]');
  await page.locator("#li-totp").waitFor({ timeout: 15000 });
  await page.fill("#li-totp", codeFor(secret));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]')
  ]);
  await page.waitForLoadState("networkidle");
  await dismiss(page);
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await dismiss(page);
  check(
    (await page.getByText(/on — a current code is required at sign-in/i).count()) === 1,
    "account page reports MFA on"
  );
  await page.fill("#mfa-off-code", codeFor(secret));
  await page.getByRole("button", { name: "Turn off" }).click();
  const notice = page.getByRole("status");
  await notice.waitFor({ timeout: 10000 });
  check(
    /two-factor authentication is off/i.test((await notice.textContent()) ?? ""),
    "disable with a current code turns MFA off"
  );
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  hookErrors(page, "post-disable");
  await signIn(page);
  const body = (await page.locator("body").textContent().catch(() => "")) ?? "";
  check(!/session is no longer valid/i.test(body), "after disable, password-only sign-in works again");
  await ctx.close();
}

await browser.close();
console.log(errs.length ? `console/page errors: ${errs.join(" | ")}` : "no console errors");
if (errs.length) failures.push("console/page errors during the drive");
if (failures.length) {
  console.error(`\n${failures.length} MFA check(s) failed:`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log("\nAll MFA checks passed.");
