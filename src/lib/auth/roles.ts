// Role definitions live in their own edge-safe module (no db, no bcrypt) so
// both the middleware/edge config and the node runtime can import them.
export type Role = "readonly" | "user" | "admin";

export const ROLE_RANK: Record<Role, number> = { readonly: 0, user: 1, admin: 2 };

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  noticeAcked: boolean;
}

export function meetsRole(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
