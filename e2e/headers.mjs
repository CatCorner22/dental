// Security-headers drive: the full set next.config.mjs promises, read off
// the wire of a PRODUCTION build — a page, an API route, a static chunk, and
// the /reset override (which must WIN over the globals; Next keeps the last
// same-key header, an easy silent regression). Also pins: no unsafe-eval in
// the production CSP, no x-powered-by, no HSTS preload without the opt-in.
//
// Requires any running production server; no sign-in needed (headers only).
//   BASE_URL=http://127.0.0.1:3000 node e2e/headers.mjs
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };

async function headersOf(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, h: res.headers };
}

// A real static chunk path from the running build.
const page = await (await fetch(`${BASE}/login`)).text();
const chunk = (page.match(/\/_next\/static\/chunks\/[^"]+\.js/) ?? [null])[0];

const surfaces = [
  ["/login", "page"],
  ["/api/submit-config", "api route"],
  [chunk, "static chunk"]
];
for (const [path, label] of surfaces) {
  if (!path) { check(false, `no static chunk found in /login HTML`); continue; }
  const { h } = await headersOf(path);
  const csp = h.get("content-security-policy") ?? "";
  check(csp.includes("default-src 'self'"), `${label}: CSP default-src 'self'`);
  check(!csp.includes("unsafe-eval"), `${label}: production CSP has NO unsafe-eval`);
  check(csp.includes("frame-ancestors 'none'"), `${label}: CSP frame-ancestors 'none'`);
  check(h.get("x-frame-options") === "DENY", `${label}: X-Frame-Options DENY`);
  check(h.get("x-content-type-options") === "nosniff", `${label}: nosniff`);
  check((h.get("referrer-policy") ?? "") === "same-origin", `${label}: Referrer-Policy same-origin (no-referrer would break no-JS login)`);
  check((h.get("permissions-policy") ?? "").includes("microphone=(self)"), `${label}: Permissions-Policy allows mic to self only`);
  check((h.get("permissions-policy") ?? "").includes("camera=()"), `${label}: camera fully denied`);
  const hsts = h.get("strict-transport-security") ?? "";
  check(hsts.includes("max-age=") && hsts.includes("includeSubDomains"), `${label}: HSTS present`);
  check(!hsts.includes("preload"), `${label}: HSTS preload absent without HSTS_PRELOAD=1`);
  check(h.get("cross-origin-opener-policy") === "same-origin", `${label}: COOP same-origin`);
  check(h.get("cross-origin-resource-policy") === "same-origin", `${label}: CORP same-origin`);
  check(h.get("x-powered-by") === null, `${label}: x-powered-by absent`);
}

// The /reset override: no-store + no-referrer must WIN over the globals.
{
  const { h } = await headersOf("/reset/some-token");
  check((h.get("cache-control") ?? "").includes("no-store"), "reset page: Cache-Control no-store");
  check(h.get("referrer-policy") === "no-referrer", `reset page: Referrer-Policy no-referrer override wins (${h.get("referrer-policy")})`);
}

if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll header checks passed.");
