/**
 * Neon (and most hosted Postgres providers) ship `sslmode=require` in the
 * connection string. node-pg currently treats require/prefer/verify-ca as
 * aliases for verify-full and emits a SECURITY WARNING on every cold start.
 *
 * Pin verify-full explicitly: that is today's effective behavior, and when
 * pg v9 adopts weaker libpq semantics for `require` we keep certificate
 * verification instead of silently downgrading.
 *
 * Do not use `uselibpqcompat=true` here — that opts into the weaker meaning.
 */
export function pinPostgresSslMode(url: string): string {
  // Vercel/Neon paste mistakes sometimes wrap the URL in quotes; strip them
  // so the sslmode rewrite actually matches.
  let out = url.trim().replace(/^['"]+|['"]+$/g, "");

  out = out.replace(
    /([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/gi,
    "$1verify-full"
  );

  // A REMOTE URL WITH NO sslmode MUST NOT FALL THROUGH TO node-pg's DEFAULT,
  // which is no TLS at all.
  //
  // This used to pin verify-full for `*.neon.tech` only. Every other provider —
  // Supabase, RDS, Railway, a self-hosted box — whose dashboard hands out a
  // connection string without `?sslmode=` therefore connected in PLAINTEXT, and
  // the thing crossing that wire is clinical notes. The host that happens to be
  // in the URL is not what decides whether the connection needs encrypting;
  // whether it leaves the machine is.
  //
  // So the rule is inverted: pin verify-full for everything EXCEPT loopback.
  // A local socket or 127.0.0.1 never leaves the host, and local Postgres (and
  // the durability harness in scripts/) has no certificate to verify — forcing
  // TLS there would break development while protecting nothing.
  if (!/[?&]sslmode=/i.test(out) && !isLoopbackPostgres(out)) {
    out += out.includes("?") ? "&sslmode=verify-full" : "?sslmode=verify-full";
  }

  return out;
}

/** Loopback and unix-socket URLs: the bytes never reach a network. */
function isLoopbackPostgres(url: string): boolean {
  // A unix-socket URL carries no host at all (postgresql:///db?host=/var/run).
  if (/^postgres(?:ql)?:\/\/\/|[?&]host=%2F|[?&]host=\//i.test(url)) return true;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Unparseable: treat as remote. Refusing to guess is the safe direction —
    // the worst case is a TLS attempt against a local box, not plaintext PHI.
    return false;
  }
  // IPv6 hostnames arrive bracketed from the URL parser on some runtimes.
  const bare = host.replace(/^\[|\]$/g, "");
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1" || bare === "";
}
