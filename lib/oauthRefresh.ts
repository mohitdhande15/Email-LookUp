/**
 * Google OAuth Token Refresh Helper.
 * Automatically exchanges an expired access token for a fresh one using the refresh token.
 */

export interface OAuthTokenData {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
  [key: string]: unknown;
}

export async function refreshGoogleAccessToken(
  token: OAuthTokenData
): Promise<OAuthTokenData> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!token.refreshToken) {
    return {
      ...token,
      error: "MissingRefreshTokenError",
    };
  }

  if (!clientId || !clientSecret) {
    return {
      ...token,
      error: "MissingGoogleOAuthConfigError",
    };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + (refreshedTokens.expires_in ?? 3600)),
      // Fall back to old refresh token if Google didn't return a new one
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: "RefreshAccessTokenNetworkError",
    };
  }
}
