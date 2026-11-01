import { describe, it, expect } from "vitest";
import { defaultSecurityEngine } from "@/lib/intelligence/security/securityEngine";
import { defaultRiskEngine } from "@/lib/intelligence/risk/riskEngine";
import { type RawEmailSecurityInput } from "@/lib/intelligence/security/securityEventDetector";
import { type BreachEntry } from "@/lib/sources/breach";

describe("SecurityEngine Integration", () => {
  it("processes synthetic security emails and breaches into unified findings and lockdown steps", async () => {
    const rawInputs: RawEmailSecurityInput[] = [
      {
        messageId: "msg_sec_1",
        senderDomain: "google.com",
        senderDisplayName: "Google",
        subject: "Security alert: New sign-in from unfamiliar device",
        dateStr: "2026-10-15T10:00:00Z",
        snippet: "A new sign-in was observed on your Google Account from Chrome on a Windows PC near New York, US. IP: 198.51.100.22.",
      },
      {
        messageId: "msg_sec_2",
        senderDomain: "github.com",
        senderDisplayName: "GitHub",
        subject: "[GitHub] A new personal access token was created",
        dateStr: "2026-10-14T08:00:00Z",
        snippet: "A new personal access token with repo scope was created on your account.",
      },
      {
        messageId: "msg_sec_3",
        senderDomain: "dropbox.com",
        senderDisplayName: "Dropbox",
        subject: "Two-factor authentication disabled",
        dateStr: "2026-10-12T14:00:00Z",
        snippet: "Two-factor authentication has been turned off for your Dropbox account.",
      },
    ];

    const breaches: BreachEntry[] = [
      {
        name: "Adobe",
        date: "2013-10-04",
        xposedData: ["Email addresses", "Passwords"],
        records: 153000000,
      },
    ];

    const result = await defaultSecurityEngine.analyzeSecurityFootprint(
      "test_user_sec",
      rawInputs,
      breaches
    );

    // Verify Events
    expect(result.events).toHaveLength(3);
    const mfaDisabled = result.events.find((e) => e.eventType === "MFA_DISABLED");
    expect(mfaDisabled).toBeDefined();
    expect(mfaDisabled?.severity).toBe("CRITICAL");

    const unfamiliarLogin = result.events.find((e) => e.eventType === "UNFAMILIAR_DEVICE_LOGIN");
    expect(unfamiliarLogin).toBeDefined();
    expect(unfamiliarLogin?.reportedIp).toBe("198.51.100.22");
    expect(unfamiliarLogin?.reportedDevice).toBe("Windows PC");

    // Verify Findings
    expect(result.findings.length).toBeGreaterThanOrEqual(4);
    for (const f of result.findings) {
      expect(f.category).toBe("SECURITY");
      expect(f.userId).toBe("test_user_sec");
    }

    // Verify Lockdown Steps order (Tier 1 Primary Email first)
    expect(result.lockdownSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.lockdownSteps[0].criticalityTier).toBe(1); // Google / Primary Email
    expect(result.lockdownSteps[0].serviceName).toBe("Google");

    // Verify Evidence Items
    expect(result.evidence.length).toBe(3);
    for (const ev of result.evidence) {
      expect(ev.type).toBe("MAILBOX_HEADER");
      expect(ev.provenance.fingerprint).toBeDefined();
    }

    // Verify Risk Engine Integration
    const riskEval = defaultRiskEngine.evaluateFindings(result.findings);
    expect(riskEval.score).toBeGreaterThan(30);
    expect(riskEval.factors.some((f) => f.title.includes("MFA Disabled"))).toBe(true);
  });
});
