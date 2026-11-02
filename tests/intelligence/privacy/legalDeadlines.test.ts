import { describe, it, expect } from "vitest";
import {
  JURISDICTION_RULES,
  isRegulationCurrentlyEnforceable,
} from "@/lib/intelligence/privacy/legal/jurisdictionRegistry";
import { LegalDeadlineCalculator } from "@/lib/intelligence/privacy/legal/legalDeadlineCalculator";
import { LegalTemplateGenerator } from "@/lib/intelligence/privacy/legal/legalTemplateGenerator";

describe("Legal Erasure Statutory Rules & Deadline Tracker", () => {
  it("verifies GDPR 30-day initial and 60-day extension statutory rules", () => {
    const gdpr = JURISDICTION_RULES.GDPR_EU;
    expect(gdpr.initialDeadlineDays).toBe(30);
    expect(gdpr.maxExtensionDays).toBe(60);
    expect(gdpr.isStatutoryCommenced).toBe(true);
    expect(gdpr.statutoryCitations).toContain("GDPR Article 17(1) (Right to Erasure / Right to be Forgotten)");
  });

  it("verifies CCPA 45-day initial and 45-day extension statutory rules", () => {
    const ccpa = JURISDICTION_RULES.CCPA_US;
    expect(ccpa.initialDeadlineDays).toBe(45);
    expect(ccpa.maxExtensionDays).toBe(45);
    expect(ccpa.isStatutoryCommenced).toBe(true);
    expect(ccpa.statutoryCitations).toContain("Cal. Civ. Code § 1798.105 (Right to Delete Personal Information)");
  });

  it("accurately handles India DPDP Act 2023 Section 12 commencement date (May 13, 2027)", () => {
    const dpdp = JURISDICTION_RULES.DPDP_INDIA;
    expect(dpdp.statutoryCommencementDate).toBe("2027-05-13");
    expect(dpdp.isStatutoryCommenced).toBe(false);

    // As of November 2026, Section 12 is NOT yet enforceable
    const dateNov2026 = new Date("2026-11-01T00:00:00Z");
    expect(isRegulationCurrentlyEnforceable("DPDP_INDIA", dateNov2026)).toBe(false);

    // As of May 14, 2027, Section 12 IS enforceable
    const datePostCommencement = new Date("2027-05-14T00:00:00Z");
    expect(isRegulationCurrentlyEnforceable("DPDP_INDIA", datePostCommencement)).toBe(true);
  });

  it("calculates statutory deadline dates and days remaining", () => {
    const asOfDate = new Date("2026-11-01T00:00:00Z");
    const deadlines = LegalDeadlineCalculator.calculateDeadlines(
      {
        regulation: "GDPR_EU",
        requestDate: "2026-10-20T00:00:00Z",
        isExtensionClaimed: false,
      },
      asOfDate
    );

    // 2026-10-20 + 30 days = 2026-11-19
    expect(deadlines.initialDeadlineDate.slice(0, 10)).toBe("2026-11-19");
    expect(deadlines.daysRemaining).toBe(18);
    expect(deadlines.isOverdue).toBe(false);
  });

  it("calculates extension deadline when extension is claimed", () => {
    const asOfDate = new Date("2026-11-01T00:00:00Z");
    const deadlines = LegalDeadlineCalculator.calculateDeadlines(
      {
        regulation: "CCPA_US",
        requestDate: "2026-10-01T00:00:00Z",
        isExtensionClaimed: true,
      },
      asOfDate
    );

    // CCPA 45 initial + 45 extension = 90 days from Oct 1
    expect(deadlines.extensionDeadlineDate).toBeDefined();
    expect(deadlines.daysRemaining).toBeGreaterThan(45);
  });

  it("flags overdue requests accurately", () => {
    const asOfDate = new Date("2026-11-01T00:00:00Z");
    const deadlines = LegalDeadlineCalculator.calculateDeadlines(
      {
        regulation: "GDPR_EU",
        requestDate: "2026-09-01T00:00:00Z", // 61 days ago
        isExtensionClaimed: false,
      },
      asOfDate
    );

    expect(deadlines.isOverdue).toBe(true);
    expect(deadlines.status).toBe("OVERDUE");
    expect(deadlines.urgencyLevel).toBe("EXPIRED");
  });

  it("generates legal notice with citations and disclaimer", () => {
    const notice = LegalTemplateGenerator.generateNotice({
      serviceName: "Acme Analytics",
      senderDomain: "acme.com",
      userEmail: "test@example.com",
      regulation: "GDPR_EU",
    });

    expect(notice.recipientEmail).toBe("privacy@acme.com");
    expect(notice.body).toContain("Article 17(1)");
    expect(notice.body).toContain("Right to Erasure");
    expect(notice.disclaimer).toContain("DISCLAIMER");
    expect(notice.mailtoUrl).toContain("mailto:privacy@acme.com");
  });
});
