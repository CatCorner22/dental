import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "../client";
import { passwordResetTokens, users, type PasswordResetTokenRow } from "../schema";

export async function insertResetToken(
  db: Db,
  row: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdById: string | null;
  }
): Promise<void> {
  await db.insert(passwordResetTokens).values(row);
}

// Issuing a new link invalidates any earlier outstanding one for that account.
// Otherwise a link a person no longer trusts (forwarded, screenshotted, sent to
// a since-changed address) keeps working until it expires on its own.
export async function invalidateUserResetTokens(db: Db, userId: string, now: Date): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
}

export async function findLiveResetToken(
  db: Db,
  tokenHash: string,
  now: Date
): Promise<PasswordResetTokenRow | undefined> {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row) return undefined;
  if (row.usedAt !== null) return undefined; // single use
  if (row.expiresAt.getTime() <= now.getTime()) return undefined;
  return row;
}

// Redeem atomically: set the new password AND consume the token in one
// transaction, with the consume guarded on the token still being unused. Two
// simultaneous redemptions of the same link therefore cannot both succeed —
// without the guard, a forwarded link could be used twice, and the second use
// would silently overwrite the password the first person just chose.
//
// passwordChangedAt is set so every session minted before this instant dies on
// its next request (the watermark in guards.ts) — resetting a possibly
// compromised account must cut off the attacker's existing cookie too.
export async function redeemResetToken(
  db: Db,
  tokenId: string,
  userId: string,
  passHash: string,
  now: Date
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)))
      .returning();
    if (claimed.length === 0) return false;
    await tx
      .update(users)
      .set({ passHash, passwordChangedAt: now })
      .where(eq(users.id, userId));
    // Retire any OTHER live link for this account too: issuing is not
    // transactional with invalidation, so a race can leave two live tokens and
    // redeeming one must not leave the other usable.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    return true;
  });
}

// Set a password and, in the SAME transaction, consume every outstanding reset
// link for that account.
//
// Every password write must go through here. Otherwise a link that was already
// mailed stays live for the rest of its hour, and the textbook remediation —
// "someone may have seen my reset email, I will change my password" — does not
// actually remediate: the attacker still holds a working bearer credential and
// can take the account after the victim has fixed it. passwordChangedAt also
// kills every existing session via the watermark in guards.ts.
export async function setPasswordAndRevokeLinks(
  db: Db,
  userId: string,
  passHash: string,
  now: Date
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passHash, passwordChangedAt: now }).where(eq(users.id, userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  });
}

// Housekeeping: tokens that are spent or long expired carry no information.
// Pruned on the path that creates them, so the table cannot grow without bound
// on a busy practice.
export async function pruneResetTokens(db: Db, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db
    .delete(passwordResetTokens)
    .where(
      or(
        lt(passwordResetTokens.expiresAt, cutoff),
        and(sql`${passwordResetTokens.usedAt} IS NOT NULL`, lt(passwordResetTokens.usedAt, cutoff))
      )
    );
}
