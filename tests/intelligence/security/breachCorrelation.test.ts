import { describe, it, expect } from "vitest";
import { BreachCorrelationEngine } from "@/lib/intelligence/security/breachCorrelation";
import { type BreachEntry } from "@/lib/sources/breach";
import { type SecurityEvent } from "@/lib/intelligence/security/securityTypes";

describe("BreachCorrelationEngine", () => {
  const syntheticBreaches: BreachEntry[] = [
    {
      name: "Adobe",
      date: "2013-10-04",
      xposedData: ["Email addresses", "Password hints", "Usernames"],
      records: 153000000,
    },
    {
      name: "Dropbox",
      date: "2024-05-01",
      xposedData: ["Email addresses", "Passwords", "Auth Tokens"],
      records: 68000000,
    },
  ];

  it("differentiates historical breach from active compromise", () => {
    const results = BreachCorrelationEngine.correlateBreaches(
      syntheticBreaches,
      [],
      new Set()
    );

    expect(results).toHaveLength(2);
    const adobe = results.find((r) => r.breachName === "Adobe");
    expect(adobe).toBeDefined();
    expect(adobe?.historicalDaysAgo).toBeGreaterThan(365 * 5);
    expect(adobe?.isCurrentCompromiseLikely).toBe(false);
    expect(adobe?.riskExplanation).toContain("Historical Exposure");
  });

  it("correlates subsequent suspicious logins with breach to flag likely compromise", () => {
    const suspiciousEvents: SecurityEvent[] = [
      {
        id: "ev_1",
        userId: "test_user",
        serviceName: "Dropbox",
        sourceDomain: "dropbox.com",
        category: "AUTHENTICATION",
        eventType: "UNFAMILIAR_DEVICE_LOGIN",
        observedAt: "2026-05-10T12:00:00Z",
        actionStatus: "COMPLETED",
        confidence: 0.9,
        severity: "HIGH",
        verificationStatus: "CONFIRMED_FACT",
        isLocationEstimated: true,
        recommendedActionTitle: "Login alert",
        recommendedActionDescription: "Unfamiliar device",
      },
    ];

    const results = BreachCorrelationEngine.correlateBreaches(
      syntheticBreaches,
      suspiciousEvents,
      new Set()
    );

    const dropbox = results.find((r) => r.breachName === "Dropbox");
    expect(dropbox?.subsequentSecurityEvents).toHaveLength(1);
    expect(dropbox?.isCurrentCompromiseLikely).toBe(true);
    expect(dropbox?.riskExplanation).toContain("High Exposure");
  });

  it("respects user-confirmed remediation", () => {
    const results = BreachCorrelationEngine.correlateBreaches(
      syntheticBreaches,
      [],
      new Set(["adobe"])
    );

    const adobe = results.find((r) => r.breachName === "Adobe");
    expect(adobe?.isRemediationConfirmed).toBe(true);
    expect(adobe?.riskExplanation).toContain("Remediation confirmed");
  });
});
