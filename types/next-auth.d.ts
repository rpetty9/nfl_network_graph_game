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
      createdAt: string | null;
      username: string | null;
      avatarStyle: string;
      avatarBg: string;
      avatarAccent: string;
      avatarBorder: string;
      featuredBadges: string[];
      badges: UserBadge[];
      stats: {
        puzzles_submitted: number;
        leaderboard_finishes: number;
        links_created: number;
        longest_submission_streak: number;
        friends_count: number;
        friend_daily_wins: number;
      };
      needsUsername: boolean;
      isAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    googleSubject?: string;
    createdAt?: string | null;
    username?: string | null;
    avatarStyle?: string;
    avatarBg?: string;
    avatarAccent?: string;
    avatarBorder?: string;
    featuredBadges?: string[];
    badges?: UserBadge[];
    stats?: {
      puzzles_submitted: number;
      leaderboard_finishes: number;
      links_created: number;
      longest_submission_streak: number;
      friends_count: number;
      friend_daily_wins: number;
    };
    needsUsername?: boolean;
    isAdmin?: boolean;
  }
}
