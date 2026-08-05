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
  return url.replace(
    /([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/gi,
    "$1verify-full"
  );
}
