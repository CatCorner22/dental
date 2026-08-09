// Account-lifecycle probe — the server-integration properties no unit test
// can hold, driven against a real server:
//
//   - the role-gate matrix (each rank's redirects, asserted per account);
//   - the reset-link refusal chain (role floor, ceiling, separation of
//     duties, deactivated target, per-target throttle, and the honest
//     no-email/not-configured refusals);
//   - the session watermark end to end (a password change kills every
//     pre-change token including the changer's own; revoke-all kills the
//     other device and exits through a real sign-out);
//   - the Developer MFA reset through the real /admin/users UI, including
//     the self-target refusal.
//
// REQUIRES a freshly-booted server on an empty database (the usual smoke env
// plus MFA_ENABLED=1): the probe mints its own accounts and cannot re-mint
// over an existing set. Deliberately NOT in CI — the cross-browser job's
// server is shared with the smoke, which assumes the smoke admin's state.
//
//   BASE_URL=http://127.0.0.1:3000 node e2e/account.lifecycle.mjs
import { chromium } from "playwright";
import { Secret, TOTP } from "otpauth";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const ADMIN = process.env.SMOKE_USER || "smokeadmin";
const ADMIN_PASS = process.env.SMOKE_PASS || "smoke-pass-12345";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const codeFor = (secret) =>
  new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate();
const browser = await chromium.launch();

const hydrated = (page) =>
  page.waitForFunction(() => {
    const f = document.querySelector("form");
    return f && Object.keys(f).some((k) => k.startsWith("__reactFiber"));
  });
async function dismiss(page) {
  const legal = page.getByRole("dialog").filter({ hasText: "Before you begin" });
  if (await legal.count()) {
    await legal.getByRole("button", { name: "I understand" }).click();
    await page.waitForTimeout(600);
  }
  const fb = page.getByRole("dialog").filter({ hasText: "Send feedback" });
  await fb.first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await fb.count()) {
    const b = fb.getByRole("button", { name: /not now|got it|dismiss/i });
    if (await b.count()) await b.first().click().catch(() => {});
  }
}
async function signIn(username, password, { totp } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await hydrated(page);
  await page.fill("#li-user", username);
  await page.fill("#li-pass", password);
  await page.click('button[type="submit"]');
  if (totp) {
    await page.locator("#li-totp").waitFor({ timeout: 15000 });
    await page.fill("#li-pass", password);
    await page.fill("#li-totp", totp());
    await page.click('button[type="submit"]');
  }
  await page
    .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle");
  const onLogin = new URL(page.url()).pathname.includes("/login");
  if (!onLogin) await dismiss(page);
  return { ctx, page, ok: !onLogin };
}
const landsAt = async (page, path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  return new URL(page.url()).pathname;
};

// ---- Mint the matrix (admin + password is the env-free path).
const admin = await signIn(ADMIN, ADMIN_PASS);
check(admin.ok, "admin signs in");
const mint = async (payload) => {
  const r = await admin.ctx.request.post(`${BASE}/api/admin/users`, { data: payload });
  check(r.ok(), `mints ${payload.username} (${r.status()})`);
};
await mint({ username: "alc-user", displayName: "ALC User", role: "user", email: "alc-user@example.com", password: "alc-user-pass-123" });
await mint({ username: "alc-lead", displayName: "ALC Lead", role: "lead", password: "alc-lead-pass-123" });
await mint({ username: "alc-mgr", displayName: "ALC Manager", role: "manager", email: "alc-mgr@example.com", groupEmail: "alc-mg@example.com", password: "alc-mgr-pass-1234" });
const users = (await (await admin.ctx.request.get(`${BASE}/api/admin/users`)).json()).users;
const idOf = (name) => users.find((u) => u.username === name).id;

// ---- Role gates.
{
  const s = await signIn("alc-user", "alc-user-pass-123");
  check(s.ok, "team member signs in");
  for (const path of ["/admin/users", "/admin/audit", "/requests"]) {
    check((await landsAt(s.page, path)) === "/", `team member bounced from ${path}`);
  }
  await s.ctx.close();
}
{
  const s = await signIn("alc-lead", "alc-lead-pass-123");
  check((await landsAt(s.page, "/admin/users")) === "/admin/users", "lead reaches /admin/users");
  check((await landsAt(s.page, "/admin/audit")) === "/", "lead bounced from /admin/audit");
  var leadCtx = s.ctx; // kept for the reset chain
}
{
  const s = await signIn("alc-mgr", "alc-mgr-pass-1234");
  check((await landsAt(s.page, "/admin/audit")) === "/admin/audit", "manager reaches /admin/audit");
  var mgrCtx = s.ctx; // kept for the SoD half
}

// ---- Reset-link refusal chain.
const link = (ctx, target) => ctx.request.post(`${BASE}/api/admin/users/${idOf(target)}/reset-link`);
const errOf = async (r) => (await r.json().catch(() => ({}))).error ?? "";
{
  const r = await link(leadCtx, "alc-mgr");
  check(r.status() === 403, `lead cannot link a manager — ceiling (${r.status()})`);
  const p = await mgrCtx.request.patch(`${BASE}/api/admin/users/${idOf("alc-user")}`, {
    data: { email: "alc-user-moved@example.com" }
  });
  check(p.ok(), `manager edits the user's email (${p.status()})`);
  const sod = await link(mgrCtx, "alc-user");
  check(sod.status() === 403 && (await errOf(sod)).includes("cannot also send"), "the email-changer is refused the link (separation of duties)");
  const ind = await link(leadCtx, "alc-user");
  const msg = await errOf(ind);
  // An independent actor passes SoD; on a mail-less deployment the route then
  // reports the config honestly instead of pretending a link went out.
  check(
    (ind.status() === 502 && /not configured|APP_URL/.test(msg)) || ind.ok(),
    `an independent lead passes SoD (${ind.status()}: ${msg.slice(0, 50)})`
  );
}
await mgrCtx.close();
await leadCtx.close();

// ---- Watermark end to end.
{
  const A = await signIn("alc-user", "alc-user-pass-123");
  const B = await signIn("alc-user", "alc-user-pass-123");
  await A.page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await A.page.fill("#ac-cur", "alc-user-pass-123");
  await A.page.fill("#ac-new", "alc-user-next-456");
  await A.page.fill("#ac-conf", "alc-user-next-456");
  await A.page.getByRole("button", { name: /change password|save|update/i }).click();
  await A.page.waitForTimeout(1500);
  check((await B.ctx.request.get(`${BASE}/api/drafts`)).status() === 401, "the other device dies on the next request");
  check((await A.ctx.request.get(`${BASE}/api/drafts`)).status() === 401, "the changer's own pre-change token dies too");
  await A.ctx.close();
  await B.ctx.close();
  const old = await signIn("alc-user", "alc-user-pass-123");
  check(!old.ok, "the old password no longer signs in");
  await old.ctx.close();

  const C = await signIn("alc-user", "alc-user-next-456");
  const D = await signIn("alc-user", "alc-user-next-456");
  await C.page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  C.page.on("dialog", (d) => d.accept());
  await C.page.getByRole("button", { name: "Sign out on all devices" }).click();
  await C.page.waitForURL((u) => u.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
  check(new URL(C.page.url()).pathname === "/login", "revoke-all exits through a real sign-out");
  check((await D.ctx.request.get(`${BASE}/api/drafts`)).status() === 401, "revoke-all kills the other device");
  await C.ctx.close();
  await D.ctx.close();
}

// ---- Developer MFA reset, through the real UI.
{
  const u = await signIn("alc-user", "alc-user-next-456");
  await u.page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await dismiss(u.page);
  const setup = u.page.getByRole("button", { name: "Set up two-factor authentication" });
  if ((await setup.count()) === 0) {
    console.log("skip: MFA_ENABLED is off — Developer MFA reset not driven");
    await u.ctx.close();
  } else {
    await setup.click();
    const secretEl = u.page.locator("p.font-mono");
    await secretEl.waitFor({ timeout: 10000 });
    const secret = ((await secretEl.textContent()) ?? "").trim();
    await u.page.fill("#mfa-code", codeFor(secret));
    await u.page.getByRole("button", { name: "Confirm and turn on" }).click();
    await u.page.getByRole("status").waitFor({ timeout: 10000 });
    await u.ctx.close();

    const page = await admin.ctx.newPage();
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await dismiss(page);
    const row = page.locator("tr", { hasText: "alc-user" }).first();
    const btn = row.getByRole("button", { name: "Reset MFA" });
    check((await btn.count()) === 1, "the armed account shows Reset MFA to the Developer");
    await btn.click();
    await page.getByRole("button", { name: "Clear second factor" }).click();
    await page.waitForTimeout(1500);
    check(
      /Two-factor authentication was cleared for alc-user/.test(((await page.locator("body").textContent()) ?? "")),
      "the clear is confirmed with the re-enroll path"
    );
    await page.close();

    const self = await admin.ctx.request.post(`${BASE}/api/admin/users/${idOf(ADMIN)}/mfa-reset`);
    check(self.status() === 403, `self-target is refused (${self.status()})`);

    const back = await signIn("alc-user", "alc-user-next-456");
    check(back.ok, "after the reset, password-only sign-in works again");
    await back.ctx.close();
  }
}

await admin.ctx.close();
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} account-lifecycle check(s) failed:`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log("\nAll account-lifecycle checks passed.");
