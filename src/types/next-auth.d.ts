import type { Role } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: Role;
      noticeAcked: boolean;
      // Password watermark (ms epoch) captured at sign-in; 0 = never changed.
      // Optional so tokens minted before this field existed stay decodable.
      pwAt?: number;
    };
  }
  interface User {
    id?: string;
    username: string;
    displayName: string;
    role: Role;
    noticeAcked: boolean;
    pwAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    noticeAcked: boolean;
    pwAt?: number;
  }
}
