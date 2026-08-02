import type { NextAuthConfig } from "next-auth";
import type { Role } from "./roles";

interface AppToken {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  noticeAcked: boolean;
  pwAt?: number;
}

// Edge-safe: imports NOTHING from the db, bcrypt, or node built-ins. This is
// the config the middleware uses; the credentials provider (which touches the
// db) is added only in auth.ts, which runs on the node runtime.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real provider added in auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const t = token as unknown as AppToken;
        t.id = user.id ?? t.id;
        t.username = user.username;
        t.displayName = user.displayName;
        t.role = user.role;
        t.noticeAcked = user.noticeAcked;
        t.pwAt = user.pwAt;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as unknown as AppToken;
      if (token && session.user) {
        session.user.id = t.id;
        session.user.username = t.username;
        session.user.displayName = t.displayName;
        session.user.role = t.role;
        session.user.noticeAcked = t.noticeAcked;
        session.user.pwAt = t.pwAt;
      }
      return session;
    },
    authorized({ auth, request }) {
      // API routes must answer with JSON (requireRole returns 401/403), never
      // a login-page redirect that fetch() would follow into HTML.
      if (request.nextUrl.pathname.startsWith("/api/")) return true;
      // Pages: require a session; NextAuth redirects to /login otherwise.
      return Boolean(auth?.user);
    }
  }
};
