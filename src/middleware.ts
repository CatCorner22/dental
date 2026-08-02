import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Edge middleware uses only the db-free config. It gates page navigation;
// every API route additionally re-checks the role via requireRole (guards.ts).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Everything except the public auth pages, the auth/setup/reset APIs, and
    // static assets. Each exclusion is anchored to a segment boundary so a
    // future route like /login-help or /setup-guide is NOT silently public.
    //
    // /reset and /api/reset MUST be public: the entire point of a reset link is
    // that someone who cannot sign in can use it. The token in the URL is the
    // credential, and the POST handler is what judges it.
    "/((?!login(?:/|$)|setup(?:/|$)|reset(?:/|$)|api/auth(?:/|$)|api/setup(?:/|$)|api/reset(?:/|$)|_next/static|_next/image|favicon\\.ico$|icon\\.svg$).*)"
  ]
};
