import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Edge middleware uses only the db-free config. It gates page navigation;
// every API route additionally re-checks the role via requireRole (guards.ts).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Everything except the public auth pages, the auth/setup APIs, and static assets.
    "/((?!login|setup|api/auth|api/setup|_next/static|_next/image|favicon.ico|icon.svg).*)"
  ]
};
