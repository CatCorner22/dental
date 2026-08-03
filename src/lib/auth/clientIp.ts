// How many trusted proxies sit in front of this app and APPEND to
// x-forwarded-for. The trustworthy client is that many entries from the RIGHT;
// everything to its left is caller-supplied and forgeable. Default 1 (a single
// reverse proxy / edge). Operators behind a deeper chain set TRUSTED_PROXY_HOPS.
export const TRUSTED_PROXY_HOPS = Math.max(1, Math.trunc(Number(process.env.TRUSTED_PROXY_HOPS)) || 1);

// Whether to believe forwarding headers at all.
//
// THE HONEST STATEMENT OF THE PROBLEM: nothing in an HTTP header is evidence.
// `x-real-ip` is trustworthy only because a proxy in front of us OVERWRITES it
// on every request; with no such proxy, any caller sets it to anything, and a
// throttle keyed on it is a throttle keyed on a number the attacker chose.
// The code cannot detect which deployment it is in — that is a fact about the
// network, so it has to be configuration.
//
// The default is "auto" (believe the headers) because that matches every
// intended deployment — Vercel, or a self-hosted box behind nginx. An operator
// running Node directly on a public port sets TRUST_PROXY_HEADERS=none.
//
// What makes "auto" survivable rather than merely convenient is that the login
// budget is no longer the only thing between an anonymous caller and the CPU.
// hashGate.ts caps CONCURRENT bcrypt process-wide on a key nobody can forge, so
// header rotation buys attempts and still cannot saturate the server.
const TRUST_HEADERS = (process.env.TRUST_PROXY_HEADERS ?? "auto").toLowerCase() !== "none";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// A parsed address becomes a throttle key, so its SHAPE matters twice over.
//
// Too permissive and the throttle silently stops working: the first version of
// this accepted any run of hex, dots and colons, which admits "1.2.3.4:5678".
// Azure App Service and some nginx configurations append `ip:port` to
// x-forwarded-for, and since the ephemeral port changes on every connection,
// EVERY request would land under a different key. The failure is invisible —
// no error, no lock, just a counter that never reaches two — and it is caused
// by the deployment rather than by an attacker.
//
// So the address is validated properly, and the port is stripped rather than
// silently swallowed into the key.
function isIpv4(s: string): boolean {
  const m = IPV4.exec(s);
  return m !== null && m.slice(1).every((o) => o.length <= 3 && Number(o) <= 255);
}

function isIpv6(s: string): boolean {
  if (s.length > 45 || !/^[0-9a-fA-F:]*$/.test(s)) return false;
  const doubleColons = s.split("::").length - 1;
  if (doubleColons > 1) return false;
  const groups = s.split(":").filter((g) => g !== "");
  if (groups.length === 0 || groups.length > 8) return false;
  if (doubleColons === 0 && s.split(":").length !== 8) return false;
  return groups.every((g) => g.length <= 4);
}

/**
 * Normalize one forwarded-for entry to a bare address, or null if it is not one.
 *
 * Handles the forms real proxies emit: a bare address, `[v6]:port`, `v4:port`,
 * and an RFC 4007 zone suffix. Anything else — RFC 7239's `unknown` and `_id`
 * obfuscated identifiers, junk, an oversized string — is NOT an address, and
 * the caller must treat it as such rather than reaching past it.
 */
export function normalizeIp(raw: string): string | null {
  let s = raw.trim();
  if (!s || s.length > 60) return null;
  // [2001:db8::1]:443 and [2001:db8::1]
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(s);
  if (bracketed) s = bracketed[1]!;
  // Zone index (fe80::1%eth0) identifies an interface, not a peer.
  const pct = s.indexOf("%");
  if (pct !== -1) s = s.slice(0, pct);
  if (isIpv6(s)) return s.toLowerCase(); // one budget per address, not per casing
  // 203.0.113.5:44321 — strip the ephemeral port, keep the address.
  const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(s);
  if (v4port) s = v4port[1]!;
  return isIpv4(s) ? s : null;
}

// `Headers.get()` joins repeated header lines with ", ", so even a header a
// proxy is supposed to own can arrive as a list when the proxy APPENDS instead
// of overwriting — with the client's forged copy first. Taking [0] would hand
// an attacker the exact value they chose; the proxy's own entry is the last.
function proxyOwnedToken(v: string | null | undefined): string | null {
  if (!v) return null;
  const parts = v.split(",");
  return normalizeIp(parts[parts.length - 1]!);
}

// The client IP used to throttle login. Deriving it wrong is a security bug in
// BOTH directions: trust a forgeable value and an attacker rotates it to evade
// the throttle or spoofs a victim IP to lock it out; trust a too-shared value
// and everyone lands under one key. So we only trust headers a correctly
// configured edge sets and overwrites, and parse x-forwarded-for from the RIGHT
// — never the client-controlled leftmost entry.
export function clientIp(req: Request | undefined): string | null {
  if (!req || !TRUST_HEADERS) return null;
  // Vercel sets this to the real client and strips any client-supplied copy.
  const vercel = proxyOwnedToken(req.headers.get("x-vercel-forwarded-for"));
  if (vercel) return vercel;
  // A single value the immediate proxy sets (nginx X-Real-IP $remote_addr).
  const real = proxyOwnedToken(req.headers.get("x-real-ip"));
  if (real) return real;
  // Last resort: x-forwarded-for, read TRUSTED_PROXY_HOPS from the right so a
  // client cannot prepend a forged entry and be believed.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    // Indexed on the RAW list, then validated — never validated first.
    // Filtering junk out BEFORE indexing looks tidier and is a vulnerability:
    // dropping an unparseable rightmost entry slides the index one place left,
    // onto the attacker's own entry, and hands them the value they chose. If
    // the trusted position does not hold an address, we have no trustworthy
    // client, and saying so is the only safe answer.
    const idx = parts.length - TRUSTED_PROXY_HOPS;
    if (idx >= 0) return normalizeIp(parts[idx]!);
  }
  return null;
}
