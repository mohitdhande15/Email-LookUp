import { describe, it, expect } from "vitest";
import { assessPlatformRisk } from "@/lib/riskScore";

describe("Risk Engine & Breach Remediation", () => {
  it("classifies newsletters with low risk score and unsubscription advice", () => {
    const result = assessPlatformRisk({
      displayName: "Daily Tech Newsletter",
      domain: "substack.com",
      type: "newsletter",
      daysAgo: 10,
      statusBasis: "activity",
      emailCount: 45,
      signupLike: false,
    });

    expect(result.score).toBe(8);
    expect(result.level).toBe("low");
    expect(result.breachStatus).toBe("none");
    expect(result.recommendedAction).toContain("Unsubscribe");
  });

  it("identifies high risk for dormant breached accounts with no remediation", () => {
    const result = assessPlatformRisk({
      displayName: "Old Gaming Forum",
      domain: "oldforum.com",
      type: "account",
      daysAgo: 400,
      statusBasis: "activity",
      emailCount: 5,
      signupLike: true,
      breachInfo: {
        breached: true,
        breachName: "OldForum Leaks",
        breachDate: "2023-01-01",
      },
      lastSecurityEmailDate: null,
    });

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.level).toBe("high");
    expect(result.breachStatus).toBe("unmitigated");
    expect(result.recommendedAction).toContain("Rotate password immediately");
  });

  it("does not falsely mark breaches as fully mitigated without user verification", () => {
    const result = assessPlatformRisk({
      displayName: "Social Media Platform",
      domain: "social.com",
      type: "account",
      daysAgo: 30,
      statusBasis: "activity",
      emailCount: 12,
      signupLike: true,
      breachInfo: {
        breached: true,
        breachName: "Social Breach 2024",
        breachDate: "2024-01-15",
      },
      // Security email exists AFTER breach date
      lastSecurityEmailDate: "2024-06-01",
    });

    // Must be unverified_remediation, NOT "mitigated"
    expect(result.breachStatus).toBe("unverified_remediation");
    expect(result.reasons.some((r) => r.includes("unverified"))).toBe(true);
    expect(result.recommendedAction).toContain("Confirm credential rotation");
  });

  it("marks as mitigated when user explicitly verifies remediation", () => {
    const result = assessPlatformRisk({
      displayName: "Social Media Platform",
      domain: "social.com",
      type: "account",
      daysAgo: 30,
      statusBasis: "activity",
      emailCount: 12,
      signupLike: true,
      breachInfo: {
        breached: true,
        breachName: "Social Breach 2024",
        breachDate: "2024-01-15",
      },
      lastSecurityEmailDate: "2024-06-01",
      userVerifiedRemediation: true,
    });

    expect(result.breachStatus).toBe("mitigated");
    expect(result.reasons.some((r) => r.includes("User verified"))).toBe(true);
  });

  it("elevates score for sensitive categories like financial or shopping platforms", () => {
    const genericResult = assessPlatformRisk({
      displayName: "Generic Blog",
      domain: "genericblog.org",
      type: "account",
      daysAgo: 45,
      statusBasis: "activity",
      emailCount: 10,
      signupLike: false,
    });

    const financeResult = assessPlatformRisk({
      displayName: "Crypto Wallet Services",
      domain: "cryptowallet.io",
      type: "account",
      daysAgo: 45,
      statusBasis: "activity",
      emailCount: 10,
      signupLike: false,
    });

    expect(financeResult.score).toBeGreaterThan(genericResult.score);
    expect(financeResult.reasons.some((r) => r.includes("High-sensitivity"))).toBe(true);
  });
});
