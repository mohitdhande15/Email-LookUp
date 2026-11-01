import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refreshGoogleAccessToken } from "@/lib/oauthRefresh";

describe("OAuth Token Refresh", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_GOOGLE_ID: "mock-client-id",
      AUTH_GOOGLE_SECRET: "mock-client-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns MissingRefreshTokenError if token has no refresh token", async () => {
    const result = await refreshGoogleAccessToken({ accessToken: "old-token" });
    expect(result.error).toBe("MissingRefreshTokenError");
  });

  it("returns MissingGoogleOAuthConfigError if client credentials are not configured", async () => {
    delete process.env.AUTH_GOOGLE_ID;
    const result = await refreshGoogleAccessToken({
      accessToken: "old-token",
      refreshToken: "valid-refresh-token",
    });
    expect(result.error).toBe("MissingGoogleOAuthConfigError");
  });

  it("successfully updates access token when Google returns a refreshed token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token-12345",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = {
      accessToken: "expired-token",
      refreshToken: "persistent-refresh-token",
      expiresAt: 1000,
    };

    const result = await refreshGoogleAccessToken(token);

    expect(result.accessToken).toBe("new-access-token-12345");
    expect(result.refreshToken).toBe("persistent-refresh-token");
    expect(result.error).toBeUndefined();
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("handles error response from Google token endpoint cleanly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = {
      accessToken: "expired-token",
      refreshToken: "revoked-refresh-token",
    };

    const result = await refreshGoogleAccessToken(token);
    expect(result.error).toBe("RefreshAccessTokenError");
  });
});
