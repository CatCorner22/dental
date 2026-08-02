import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getDb } from "@/lib/db/client";
import { getUserByUsername } from "@/lib/db/repo/users";
import { verifyPassword } from "./password";
import { checkThrottle, clearThrottle, loginKey, recordFailure } from "./throttle";

// A real (never-matching) hash so unknown-username logins burn the same
// bcrypt time as wrong-password logins — otherwise response latency tells
// an attacker which usernames exist.
const TIMING_DUMMY_HASH = "$2b$12$trtV1CTHstBOdm7lfhVlbOLvcgExqOjspQH8/XiGsdsKahewnGzfS";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(creds) {
        const username = typeof creds?.username === "string" ? creds.username.trim() : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        if (!username || !password) return null;
        const db = await getDb();
        // Throttle BEFORE bcrypt: the whole point is to stop an attacker from
        // spending our CPU. Keyed by username so one account under attack
        // never locks the practice out of the others.
        const key = loginKey(username);
        const now = new Date();
        if ((await checkThrottle(db, key, now)).locked) return null;
        // New accounts are stored lowercase; the exact-match fallback keeps
        // any pre-normalization account working.
        const user =
          (await getUserByUsername(db, username)) ??
          (await getUserByUsername(db, username.toLowerCase()));
        if (!user || !user.active) {
          await verifyPassword(password, TIMING_DUMMY_HASH); // equalize timing
          await recordFailure(db, key, now);
          return null;
        }
        if (!(await verifyPassword(password, user.passHash))) {
          await recordFailure(db, key, now);
          return null;
        }
        await clearThrottle(db, key);
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          noticeAcked: user.noticeAckAt !== null,
          // Watermark this token against the password it was minted with, so
          // a later change/reset revokes it on the very next request.
          pwAt: user.passwordChangedAt?.getTime() ?? 0
        };
      }
    })
  ]
});
