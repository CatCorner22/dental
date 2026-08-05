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

  // Neon URLs without an sslmode still speak TLS; pin explicitly so a dashboard
  // copy that omits the query param does not fall through to pg defaults that
  // warn (or, later, weaken).
  if (/[.]neon[.]tech([:/?]|$)/i.test(out) && !/[?&]sslmode=/i.test(out)) {
    out += out.includes("?") ? "&sslmode=verify-full" : "?sslmode=verify-full";
  }

  return out;
}
