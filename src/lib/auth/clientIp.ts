// How many trusted proxies sit in front of this app and APPEND to
// x-forwarded-for. The trustworthy client is that many entries from the RIGHT;
// everything to its left is caller-supplied and forgeable. Default 1 (a single
// reverse proxy / edge). Operators behind a deeper chain set TRUSTED_PROXY_HOPS.
export const TRUSTED_PROXY_HOPS = Math.max(1, Math.trunc(Number(process.env.TRUSTED_PROXY_HOPS)) || 1);

function firstToken(v: string | null | undefined): string | null {
  const t = v?.split(",")[0]?.trim();
  return t || null;
}

// The client IP used to throttle login. Deriving it wrong is a security bug in
// BOTH directions: trust a forgeable value and an attacker rotates it to evade
// the throttle (unbounded bcrypt) or spoofs a victim IP to lock it out; trust a
// too-shared value and everyone lands under one key (global lockout). So we
// only trust headers a correctly-configured edge sets and overwrites, and parse
// x-forwarded-for from the RIGHT — never the client-controlled leftmost entry.
export function clientIp(req: Request | undefined): string | null {
  if (!req) return null;
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
      .filter(Boolean);
    if (parts.length) {
      const idx = parts.length - TRUSTED_PROXY_HOPS;
      return parts[idx >= 0 ? idx : 0];
    }
  }
  return null;
}
