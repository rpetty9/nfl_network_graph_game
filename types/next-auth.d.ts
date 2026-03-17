import "next-auth";
import "next-auth/jwt";
import type { UserBadge } from "@/lib/badges";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      username: string | null;
      avatarStyle: string;
      avatarBg: string;
      avatarAccent: string;
      featuredBadges: string[];
      badges: UserBadge[];
      needsUsername: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    googleSubject?: string;
    username?: string | null;
    avatarStyle?: string;
    avatarBg?: string;
    avatarAccent?: string;
    featuredBadges?: string[];
    badges?: UserBadge[];
    needsUsername?: boolean;
  }
}
