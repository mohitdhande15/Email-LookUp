/**
 * Central Environment Configuration & Secret Validator.
 * Prevents insecure defaults, missing critical secrets, and hardcoded credentials.
 */

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    const isBuildPhase =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build";

    if (process.env.NODE_ENV === "production" && !isBuildPhase) {
      throw new Error(
        "[SECURITY ERROR] Missing mandatory AUTH_SECRET environment variable in production runtime. " +
          "Refusing to serve production traffic with insecure default secret."
      );
    }

    // Development or build phase warning
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[SECURITY WARNING] AUTH_SECRET is not set. Using temporary fallback key for build/development. " +
          "Configure AUTH_SECRET in your production environment."
      );
    }
    return "dev-local-only-smart-digital-declutter-auth-secret-min32chars";
  }

  return secret;
}

export function getGoogleOAuthCredentials(): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  };
}

export function getGitHubToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === "paste_your_token_here") {
    return undefined;
  }
  return token;
}
