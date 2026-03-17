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

          token.appUserId = appUser.user_id;
          token.googleSubject = appUser.google_subject;
          token.username = appUser.username;
          token.needsUsername = !appUser.username;
        }

        return token;
      }

      if (trigger === "update" && token.appUserId) {
        const refreshedUser = await getUserById(String(token.appUserId));
        if (refreshedUser) {
          token.username = refreshedUser.username;
          token.needsUsername = !refreshedUser.username;
        }
        return token;
      }

      if (token.googleSubject) {
        const appUser = await getUserByGoogleSubject(String(token.googleSubject));
        if (appUser) {
          token.appUserId = appUser.user_id;
          token.username = appUser.username;
          token.needsUsername = !appUser.username;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.appUserId ? String(token.appUserId) : "";
        session.user.username =
          typeof token.username === "string" ? token.username : null;
        session.user.needsUsername = Boolean(token.needsUsername);
      }

      return session;
    },
  },
});
