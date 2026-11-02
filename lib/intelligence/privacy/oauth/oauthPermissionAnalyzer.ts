import {
  type OAuthAppRecord,
  type OAuthPermission,
  type OAuthProviderType,
} from "../privacyTypes";
import { KNOWN_SCOPES, OAUTH_PROVIDERS } from "./oauthProviderRegistry";

export class OAuthPermissionAnalyzer {
  /**
   * Resolves a scope string to human-readable permission metadata.
   */
  static resolveScope(scope: string): OAuthPermission {
    const trimmed = scope.trim();
    if (KNOWN_SCOPES[trimmed]) {
      return KNOWN_SCOPES[trimmed];
    }

    // Heuristics for unknown scopes
    const lower = trimmed.toLowerCase();
    const isCritical =
      lower.includes("admin") ||
      lower.includes("delete") ||
      lower.includes("write") ||
      lower.includes("full") ||
      lower.includes("modify");
    const isHigh =
      lower.includes("repo") ||
      lower.includes("mail") ||
      lower.includes("file") ||
      lower.includes("message");

    const riskLevel = isCritical ? "CRITICAL" : isHigh ? "HIGH" : "MEDIUM";

    return {
      scope: trimmed,
      friendlyName: trimmed.split("/").pop() ?? trimmed,
      description: `Access permission: ${trimmed}`,
      riskLevel,
      isSensitive: isCritical || isHigh,
    };
  }

  /**
   * Evaluates aggregate risk level across a set of scopes.
   */
  static evaluateAppRisk(scopes: string[]): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    if (!scopes || scopes.length === 0) return "LOW";

    const permissions = scopes.map((s) => this.resolveScope(s));
    if (permissions.some((p) => p.riskLevel === "CRITICAL")) return "CRITICAL";
    if (permissions.some((p) => p.riskLevel === "HIGH")) return "HIGH";
    if (permissions.some((p) => p.riskLevel === "MEDIUM")) return "MEDIUM";
    return "LOW";
  }

  /**
   * Detects OAuth authorization notifications from mailbox security events.
   */
  static detectFromNotification(input: {
    domain: string;
    subject: string;
    snippet?: string;
    observedAt?: string;
  }): OAuthAppRecord | null {
    const text = `${input.subject} ${input.snippet ?? ""}`.toLowerCase();
    const domain = input.domain.toLowerCase();

    let provider: OAuthProviderType = "GENERIC";
    if (domain.includes("google.com")) provider = "GOOGLE";
    else if (domain.includes("github.com")) provider = "GITHUB";
    else if (domain.includes("discord.com")) provider = "DISCORD";
    else if (domain.includes("microsoft.com") || domain.includes("live.com")) provider = "MICROSOFT";
    else if (domain.includes("apple.com")) provider = "APPLE";

    const isOauthAlert =
      text.includes("authorized") ||
      text.includes("connected to your") ||
      text.includes("new app has access") ||
      text.includes("third-party app") ||
      text.includes("granted access") ||
      text.includes("oauth application");

    if (!isOauthAlert && provider === "GENERIC") {
      return null;
    }

    // Extract app name if pattern matches
    let appName = "Third-Party Application";
    const appMatch =
      input.subject.match(/(?:to|for|application|app)\s+([A-Za-z0-9_\-\.\s]{2,30})/i) ||
      (input.snippet ? input.snippet.match(/(?:app|application|service)\s+["']?([A-Za-z0-9_\-\.\s]{2,30})["']?/i) : null);

    if (appMatch && appMatch[1]) {
      const candidate = appMatch[1].trim();
      if (!["your", "google", "account", "access", "github", "discord"].includes(candidate.toLowerCase())) {
        appName = candidate;
      }
    }

    const providerMeta = OAUTH_PROVIDERS[provider];
    const riskRating = "MEDIUM"; // Default for generic notifications unless specific scopes detected

    return {
      id: `oauth_${provider.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      provider,
      appName,
      scopes: ["Access to profile & linked account"],
      riskRating,
      grantedAt: input.observedAt ?? new Date().toISOString(),
      managementUrl: providerMeta.managementUrl,
      notes: `Detected from ${input.domain} security notice: "${input.subject}"`,
      discoveredFromDomain: input.domain,
    };
  }
}
