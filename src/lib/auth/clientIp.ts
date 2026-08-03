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
// throttle keyed on it is a throttle keyed on a number the attacker chose. They
// rotate it for an unlimited budget, or pin it to a colleague's address to lock
// that colleague out. The code cannot detect which deployment it is in — that
// is a fact about the network, so it has to be configuration.
//
// The default is "auto" (believe the headers) because that matches every
// intended deployment — Vercel, or a self-hosted box behind nginx — and because
// the failure mode of the alternative is worse: with no client address at all
// there is no per-source budget, and bcrypt becomes an open service. An operator
// running Node directly on a public port sets TRUST_PROXY_HEADERS=none, which
// is the correct answer for a configuration nobody should be running anyway.
//
// What makes "auto" survivable rather than merely convenient is that the IP
// budget is no longer the only thing standing between an anonymous caller and
// the CPU. hashGate.ts caps CONCURRENT bcrypt work process-wide, and that cap
// is keyed on nothing the caller controls — so header rotation buys unlimited
// attempts and still cannot saturate the server.
const TRUST_HEADERS = (process.env.TRUST_PROXY_HEADERS ?? "auto").toLowerCase() !== "none";

// A parsed address becomes a throttle key, so its SHAPE matters: junk values
// are a way to spray unbounded distinct keys into a table that has to be
// pruned, and to smuggle text somewhere it will later be displayed. Anything
// that is not recognisably an address is treated as absent rather than trusted
// — falling through to the next header, and ultimately to no key at all, which
// the hash gate covers.
//
// Deliberately permissive about the exact grammar (it accepts more than a
// strict IPv6 parser would) and strict about the things that matter: bounded
// length, and only the character set an address can contain.
const IP_SHAPE = /^[0-9a-fA-F:.]{3,45}$/;

function firstToken(v: string | null | undefined): string | null {
  const t = v?.split(",")[0]?.trim();
  return t && IP_SHAPE.test(t) ? t : null;
}

// The client IP used to throttle login. Deriving it wrong is a security bug in
// BOTH directions: trust a forgeable value and an attacker rotates it to evade
// the throttle (unbounded bcrypt) or spoofs a victim IP to lock it out; trust a
// too-shared value and everyone lands under one key (global lockout). So we
// only trust headers a correctly-configured edge sets and overwrites, and parse
// x-forwarded-for from the RIGHT — never the client-controlled leftmost entry.
export function clientIp(req: Request | undefined): string | null {
  if (!req || !TRUST_HEADERS) return null;
  // Vercel sets this to the real client and strips any client-supplied copy.
  const vercel = firstToken(req.headers.get("x-vercel-forwarded-for"));
  if (vercel) return vercel;
  // A single value the immediate proxy sets (nginx X-Real-IP $remote_addr, and
  // Vercel) — not a list a caller can pad.
  const real = firstToken(req.headers.get("x-real-ip"));
  if (real) return real;
  // Last resort: x-forwarded-for, read TRUSTED_PROXY_HOPS from the right so a
  // client cannot prepend a forged entry and be believed.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter((s) => IP_SHAPE.test(s));
    if (parts.length) {
      const idx = parts.length - TRUSTED_PROXY_HOPS;
      return parts[idx >= 0 ? idx : 0];
    }
  }
  return null;
}
