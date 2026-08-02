import type { Role } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: Role;
      noticeAcked: boolean;
    };
  }
  interface User {
    id?: string;
    username: string;
    displayName: string;
    role: Role;
    noticeAcked: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    noticeAcked: boolean;
  }
}
