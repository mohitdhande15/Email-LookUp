import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getAuthSecret } from "@/lib/config";
import { refreshGoogleAccessToken, type OAuthTokenData } from "@/lib/oauthRefresh";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // 1. Initial sign in: capture access token, refresh token and expiry
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      // 2. Return token if it is still valid (with 60-second grace buffer)
      const expiresAtMs = typeof token.expiresAt === "number" ? token.expiresAt * 1000 : 0;
      if (expiresAtMs && Date.now() < expiresAtMs - 60_000) {
        return token;
      }

      // 3. Access token has expired; refresh it using Google OAuth token endpoint
      return await refreshGoogleAccessToken(token as OAuthTokenData);
    },
    async session({ session, token }) {
      // Keep sensitive OAuth access/refresh tokens server-side only.
      // Expose error status if session refresh failed so UI can prompt sign-in.
      if (token?.error && typeof token.error === "string") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).error = token.error;
      }
      return session;
    },
  },
  secret: getAuthSecret(),
});
