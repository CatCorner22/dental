// Login lockout drive, over direct HTTP to the NextAuth credentials endpoint.
// The browser form path is unusable here — its feedback dialog races the click
// and ~35 sequential form logins are slow enough that a 60s IP lock lapses
// mid-loop. Posting straight to /api/auth/callback/credentials with an explicit
// x-real-ip is deterministic and fast, and it exercises the exact throttle in
// src/lib/auth/auth.ts: the pair lock (5 free, then a 15s doubling lock, keyed
// ip+username), the auth.lockout row the lock transition writes, and the IP
// spray detector (30 free across ANY usernames -> one auth.spray row, never a
// gate). A signed-in Playwright page reads the audit log for the row asserts.
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin.
//   BASE_URL=http://127.0.0.1:3000 node e2e/lockout.mjs
import { chromium } from "playwright";
import { signIn, dismiss } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();

// A csrf cookie + token pair, reused for every POST (csrf is not IP-bound).
const jar = [];
async function raw(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    redirect: "manual",
    headers: { ...(opts.headers || {}), cookie: jar.join("; ") }
  });
  for (const c of r.headers.getSetCookie?.() ?? []) jar.push(c.split(";")[0]);
  return r;
}
const csrf = (await (await raw("/api/auth/csrf")).json()).csrfToken;
async function login(username, password, ip) {
  const form = new URLSearchParams({ csrfToken: csrf, username, password, callbackUrl: `${BASE}/`, redirect: "false" });
  const r = await raw("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": ip },
    body: form.toString()
  });
  const loc = r.headers.get("location") || "";
  return /error=/.test(loc) ? "refused" : /\/login/.test(loc) ? "refused" : "signed-in";
}

// Seed the victim account.
{
  const actx = await browser.newContext();
  const ap = await actx.newPage();
  await signIn(ap, BASE);
  await actx.request.post(`${BASE}/api/admin/users`, {
    data: { username: "lockme1", displayName: "Lock Me", role: "user", password: "lockme1-pass-12345" }
  });
  await actx.close();
}

// ---- Pair lock: the 6th failure locks; the correct password is then refused
//      until the lock lapses ---------------------------------------------------
const PAIR_IP = "10.1.1.1";
{
  // 5 free failures — the pair is not locked yet.
  for (let i = 1; i <= 5; i++) {
    const r = await login("lockme1", "wrong-password-x", PAIR_IP);
    if (i === 5) check(r === "refused", "the first five wrong attempts are refused but do not lock");
  }
  // The 6th failure crosses the threshold: this is the transition that both
  // arms the lock AND writes the auth.lockout row.
  check((await login("lockme1", "wrong-password-x", PAIR_IP)) === "refused", "the 6th wrong attempt is refused");
  // Now even the CORRECT password is refused — the lock is on the pair, not on
  // the wrongness of the password.
  check((await login("lockme1", "lockme1-pass-12345", PAIR_IP)) === "refused", "with the pair locked, the CORRECT password is refused");

  // The first lock is 15s. Wait it out; a correct password must then work — a
  // lock that renews itself on every attempt would never lapse (the
  // self-renewing-lock regression the unit tests pin).
  await new Promise((r) => setTimeout(r, 16_500));
  check((await login("lockme1", "lockme1-pass-12345", PAIR_IP)) === "signed-in", "after the lock lapses, the correct password signs in");
}

// ---- IP spray detector: never a gate, exactly one row ----------------------
const SPRAY_IP = "10.2.2.2";
{
  // 31 failures across DISTINCT usernames from one address. The pair throttle
  // never engages (each pair sees one failure); the IP meter crosses 30 once.
  for (let i = 1; i <= 31; i++) {
    await login(`ghost${String(i).padStart(3, "0")}`, "nope-nope-nope", SPRAY_IP);
  }
  // The detector must NOT have become a gate: a legitimate sign-in from the
  // same address still works (its own pair has no failures).
  check((await login("lockme1", "lockme1-pass-12345", SPRAY_IP)) === "signed-in", "after the spray, a legitimate sign-in from the same address still works");
}

// ---- The audit trail: one lockout row, one spray row -----------------------
{
  const actx = await browser.newContext();
  const ap = await actx.newPage();
  await signIn(ap, BASE);
  await ap.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  await dismiss(ap);
  const rows = await ap.evaluate(() =>
    [...document.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? "").join(" | ")
    )
  );
  const lockRows = rows.filter((r) => r.includes("Sign-in locked (too many attempts)"));
  const sprayRows = rows.filter((r) => r.includes("Many failed sign-ins from one address"));
  check(lockRows.length === 1 && /lockme1/.test(lockRows[0] ?? ""), `exactly one auth.lockout row, naming the account (${lockRows.length})`);
  check(sprayRows.length === 1, `exactly one auth.spray row per window (${sprayRows.length})`);
  check(rows.some((r) => r.includes("Failed sign-in")), "individual failed sign-ins are audited");
  await actx.close();
}

await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll lockout checks passed.");
