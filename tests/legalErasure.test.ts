import { describe, it, expect } from "vitest";
import {
  generateLegalErasureNotice,
  getPrivacyContactEmail,
} from "@/lib/legalErasure";

describe("Legal Erasure Notice Generator", () => {
  it("derives correct privacy contact email for multi-part SLDs", () => {
    expect(getPrivacyContactEmail("marketing.service.co.uk")).toBe("privacy@service.co.uk");
    expect(getPrivacyContactEmail("notifications.brand.co.in")).toBe("privacy@brand.co.in");
    expect(getPrivacyContactEmail("news.app.com")).toBe("privacy@app.com");
  });

  it("generates GDPR notice with Article 17 citation and 30-day deadline", () => {
    const notice = generateLegalErasureNotice({
      serviceName: "Spotify",
      senderDomain: "spotify.com",
      userEmail: "user@example.com",
      firstSeenDate: "Jan 1, 2022",
      lastSeenDate: "Dec 31, 2024",
      regulation: "GDPR_EU",
    });

    expect(notice.recipientEmail).toBe("privacy@spotify.com");
    expect(notice.statutoryDeadlineDays).toBe(30);
    expect(notice.body).toContain("Article 17(1)");
    expect(notice.legalCitations).toContain("GDPR Article 17(1) (Right to Erasure)");
    expect(notice.jurisdictionNotes).toContain("May 25, 2018");
    expect(notice.mailtoUrl).toContain("mailto:privacy%40spotify.com");
  });

  it("properly qualifies DPDP Act 2023 with appointed date notices under § 1(2)", () => {
    const notice = generateLegalErasureNotice({
      serviceName: "Zomato",
      senderDomain: "zomato.com",
      userEmail: "user@example.com",
      regulation: "DPDP_INDIA",
    });

    expect(notice.body).toContain("Section 12(3)");
    expect(notice.body).toContain("Section 1(2)");
    expect(notice.jurisdictionNotes).toContain("Enacted August 11, 2023");
    expect(notice.legalCitations.some((c) => c.includes("DPDP Act 2023 § 12(3)"))).toBe(true);
  });

  it("generates CCPA notice with Cal. Civ. Code § 1798.105 and 45-day deadline", () => {
    const notice = generateLegalErasureNotice({
      serviceName: "Uber",
      senderDomain: "uber.com",
      userEmail: "user@example.com",
      regulation: "CCPA_US",
    });

    expect(notice.statutoryDeadlineDays).toBe(45);
    expect(notice.body).toContain("1798.105");
    expect(notice.legalCitations).toContain("Cal. Civ. Code § 1798.105 (Right to Delete)");
  });

  it("includes legal disclaimer acknowledging draft status", () => {
    const notice = generateLegalErasureNotice({
      serviceName: "Notion",
      senderDomain: "notion.so",
      userEmail: "user@example.com",
      regulation: "COMBINED",
    });

    expect(notice.disclaimer).toContain("not formal legal counsel");
    expect(notice.body).toContain("user@example.com");
  });
});
