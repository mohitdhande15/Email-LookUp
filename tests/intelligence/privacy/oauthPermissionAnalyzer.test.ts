import { describe, it, expect } from "vitest";
import { OAuthPermissionAnalyzer } from "@/lib/intelligence/privacy/oauth/oauthPermissionAnalyzer";

describe("OAuthPermissionAnalyzer & Provider Registry", () => {
  it("classifies standard scopes into proper risk tiers", () => {
    const gmailModify = OAuthPermissionAnalyzer.resolveScope("https://www.googleapis.com/auth/gmail.modify");
    expect(gmailModify.riskLevel).toBe("CRITICAL");
    expect(gmailModify.isSensitive).toBe(true);

    const githubRepo = OAuthPermissionAnalyzer.resolveScope("repo");
    expect(githubRepo.riskLevel).toBe("CRITICAL");

    const githubWorkflow = OAuthPermissionAnalyzer.resolveScope("workflow");
    expect(githubWorkflow.riskLevel).toBe("HIGH");

    const gmailReadonly = OAuthPermissionAnalyzer.resolveScope("https://www.googleapis.com/auth/gmail.readonly");
    expect(gmailReadonly.riskLevel).toBe("MEDIUM");

    const userEmail = OAuthPermissionAnalyzer.resolveScope("user:email");
    expect(userEmail.riskLevel).toBe("LOW");
  });

  it("calculates aggregate application risk based on highest scope", () => {
    const criticalAppRisk = OAuthPermissionAnalyzer.evaluateAppRisk([
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.modify",
    ]);
    expect(criticalAppRisk).toBe("CRITICAL");

    const highAppRisk = OAuthPermissionAnalyzer.evaluateAppRisk([
      "read:user",
      "workflow",
    ]);
    expect(highAppRisk).toBe("HIGH");

    const lowAppRisk = OAuthPermissionAnalyzer.evaluateAppRisk([
      "identify",
      "email",
    ]);
    expect(lowAppRisk).toBe("LOW");
  });

  it("detects OAuth authorization notifications from mailbox security events", () => {
    const alert = OAuthPermissionAnalyzer.detectFromNotification({
      domain: "google.com",
      subject: "Security alert: Third-party app Slack connected to your Google Account",
      snippet: "Slack was granted access to your Google Account.",
    });

    expect(alert).not.toBeNull();
    expect(alert?.provider).toBe("GOOGLE");
    expect(alert?.managementUrl).toBe("https://myaccount.google.com/connections");
  });
});
