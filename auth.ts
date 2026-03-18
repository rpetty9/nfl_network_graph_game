import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUserByGoogleSubject, getUserById, upsertGoogleUser } from "@/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;

      const googleSubject =
        typeof profile?.sub === "string" ? profile.sub : String(profile?.sub ?? "");
      const email =
        typeof profile?.email === "string" ? profile.email : "";

      if (!googleSubject || !email) {
        return false;
      }

      await upsertGoogleUser({
        googleSubject,
        email,
      });

      return true;
    },
    async jwt({ token, account, profile, trigger }) {
      if (account?.provider === "google") {
        const googleSubject =
          typeof profile?.sub === "string" ? profile.sub : String(profile?.sub ?? "");
        const email =
          typeof profile?.email === "string" ? profile.email : token.email ?? "";

        if (googleSubject && email) {
          const appUser = await upsertGoogleUser({
            googleSubject,
            email,
          });

          if (appUser) {
            token.appUserId = appUser.user_id;
            token.googleSubject = appUser.google_subject;
            token.createdAt = appUser.created_at;
            token.username = appUser.username;
            token.avatarStyle = appUser.avatar_style;
            token.avatarBg = appUser.avatar_bg;
            token.avatarAccent = appUser.avatar_accent;
            token.avatarBorder = appUser.avatar_border;
            token.featuredBadges = appUser.featured_badges;
            token.badges = appUser.badges;
            token.stats = appUser.stats;
            token.needsUsername = !appUser.username;
          }
        }

        return token;
      }

      if (trigger === "update" && token.appUserId) {
        const refreshedUser = await getUserById(String(token.appUserId));
        if (refreshedUser) {
          token.username = refreshedUser.username;
          token.createdAt = refreshedUser.created_at;
          token.avatarStyle = refreshedUser.avatar_style;
          token.avatarBg = refreshedUser.avatar_bg;
          token.avatarAccent = refreshedUser.avatar_accent;
          token.avatarBorder = refreshedUser.avatar_border;
          token.featuredBadges = refreshedUser.featured_badges;
          token.badges = refreshedUser.badges;
          token.stats = refreshedUser.stats;
          token.needsUsername = !refreshedUser.username;
        }
        return token;
      }

      if (token.googleSubject) {
        const appUser = await getUserByGoogleSubject(String(token.googleSubject));
        if (appUser) {
          token.appUserId = appUser.user_id;
          token.createdAt = appUser.created_at;
          token.username = appUser.username;
          token.avatarStyle = appUser.avatar_style;
          token.avatarBg = appUser.avatar_bg;
          token.avatarAccent = appUser.avatar_accent;
          token.avatarBorder = appUser.avatar_border;
          token.featuredBadges = appUser.featured_badges;
          token.badges = appUser.badges;
          token.stats = appUser.stats;
          token.needsUsername = !appUser.username;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.appUserId ? String(token.appUserId) : "";
        session.user.createdAt =
          typeof token.createdAt === "string" ? token.createdAt : null;
        session.user.username =
          typeof token.username === "string" ? token.username : null;
        session.user.avatarStyle =
          typeof token.avatarStyle === "string" ? token.avatarStyle : "helmet";
        session.user.avatarBg =
          typeof token.avatarBg === "string" ? token.avatarBg : "sky";
        session.user.avatarAccent =
          typeof token.avatarAccent === "string" ? token.avatarAccent : "amber";
        session.user.avatarBorder =
          typeof token.avatarBorder === "string" ? token.avatarBorder : "slate";
        session.user.featuredBadges = Array.isArray(token.featuredBadges)
          ? token.featuredBadges.filter((badge): badge is string => typeof badge === "string")
          : [];
        session.user.badges = Array.isArray(token.badges) ? token.badges : [];
        session.user.stats =
          token.stats &&
          typeof token.stats === "object" &&
          typeof token.stats.puzzles_submitted === "number" &&
          typeof token.stats.leaderboard_finishes === "number" &&
          typeof token.stats.links_created === "number" &&
          typeof token.stats.longest_submission_streak === "number" &&
          typeof token.stats.friends_count === "number" &&
          typeof token.stats.friend_daily_wins === "number"
            ? token.stats
            : {
                puzzles_submitted: 0,
                leaderboard_finishes: 0,
                links_created: 0,
                longest_submission_streak: 0,
                friends_count: 0,
                friend_daily_wins: 0,
              };
        session.user.needsUsername = Boolean(token.needsUsername);
      }

      return session;
    },
  },
});
