// The single rule for "is this token still alive?".
//
// A session cookie is valid for 30 days, which is far longer than the time it
// takes for the reason you trusted it to stop being true. Two events must kill
// every token minted before them:
//
//   passwordChangedAt  — the credential changed (self-service, admin reset, or
//                        a redeemed link). A stolen cookie must not survive the
//                        very remediation meant to cut it off.
//   sessionsRevokedAt  — the account holder pressed "sign out on all devices".
//                        Separate from the password because the common case is
//                        "I left myself signed in at the chairside machine",
//                        which should not require inventing a new password.
//
// Kept in one pure function because THREE places have to agree exactly: the
// sign-in that stamps the watermark onto a new token, the API guard, and the
// page guard. If minting used a different rule from checking, a freshly issued
// token could be born already dead — sign in, get bounced, sign in again,
// forever.

export interface WatermarkSource {
  passwordChangedAt: Date | null;
  sessionsRevokedAt: Date | null;
}

export function sessionWatermark(row: WatermarkSource): number {
  return Math.max(row.passwordChangedAt?.getTime() ?? 0, row.sessionsRevokedAt?.getTime() ?? 0);
}

// A token is dead when it was minted strictly before the current watermark.
// Equal counts as alive: the token issued AT the moment of a password change is
// the new one.
export function isTokenRevoked(row: WatermarkSource, tokenStamp: number | undefined): boolean {
  return sessionWatermark(row) > (tokenStamp ?? 0);
}
