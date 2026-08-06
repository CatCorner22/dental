import { resolveClinicalRole } from "./clinicalRoles";
import { cache } from "react";
import { auth } from "./auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/repo/users";
import type { SessionUser } from "./roles";
import { isTokenRevoked } from "./sessionWatermark";

// The page-side twin of requireRole: pages must never trust the 30-day JWT
// for role or active state, or a demoted/deactivated user keeps reading
// other people's drafts and the admin screens until the token expires.
// Returns null when there is no session OR the account no longer exists /
// is inactive. React cache() dedupes the DB lookup, so the layout and the
// page share one primary-key read per request.
export const freshSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user) return null;
  const db = await getDb();
  const row = await getUserById(db, session.user.id);
  if (!row || !row.active) return null;
  // Mirror requireRole's revocation check: a token minted before the last
  // password change or device sign-out must not keep rendering pages either.
  if (isTokenRevoked(row, session.user.pwAt)) return null;
  return {
    id: row.id,
    // Mirrors requireRole exactly: the two must agree, or a page and its API
    // would disagree about what someone is allowed to write.
    clinicalRole: resolveClinicalRole(row.role, row.clinicalRole),
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    noticeAcked: row.noticeAckAt !== null
  };
});
