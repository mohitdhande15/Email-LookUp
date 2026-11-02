import { describe, it, expect } from "vitest";
import { defaultPrivacyEngine, type RawEmailPrivacyInput } from "@/lib/intelligence/privacy/privacyEngine";
import { type LegalErasureTrackedRequest } from "@/lib/intelligence/privacy/privacyTypes";

describe("PrivacyEngine Unified Orchestration", () => {
  it("processes mailbox inputs, generates unified findings, entities, and privacy summary", async () => {
    const userId = "test_user@example.com";

    const inputs: RawEmailPrivacyInput[] = [
      {
        userId,
        domain: "deals.retailcorp.com",
        serviceName: "RetailCorp Daily",
        senderEmail: "promotions@retailcorp.com",
        subject: "Weekend 50% Off Flash Sale",
        timestamp: "2026-10-31T10:00:00Z",
        messageId: "msg_1",
        listUnsubscribeHeader: "<https://deals.retailcorp.com/unsub/123>, <mailto:unsub@retailcorp.com>",
        listUnsubscribePostHeader: "List-Unsubscribe=One-Click",
        bodySnippetOrHtml: '<img src="https://ct.sendgrid.net/wf/open?upn=abc" width="1" height="1" />',
        emailCount: 12,
        daysInactive: 15,
      },
      {
        userId,
        domain: "oldforums.net",
        serviceName: "Old Forums",
        senderEmail: "admin@oldforums.net",
        subject: "Your account anniversary",
        timestamp: "2025-05-01T12:00:00Z",
        messageId: "msg_2",
        emailCount: 1,
        daysInactive: 400,
      },
      {
        userId,
        domain: "google.com",
        serviceName: "Google Account",
        senderEmail: "no-reply@accounts.google.com",
        subject: "Security alert: Third-party app Slack was granted access to your Google Account",
        timestamp: "2026-10-25T14:00:00Z",
        messageId: "msg_3",
        bodySnippetOrHtml: "Slack was authorized to access basic profile info.",
      },
    ];

    const existingLegalRequests: LegalErasureTrackedRequest[] = [
      {
        id: "leg_gdpr_test",
        userId,
        targetDomain: "databroker.example",
        serviceName: "DataBroker Corp",
        regulation: "GDPR_EU",
        requestDate: "2026-10-25T00:00:00Z",
        initialDeadlineDays: 30,
        initialDeadlineDate: "2026-11-24T00:00:00Z",
        isExtensionClaimed: false,
        status: "SUBMITTED",
        contactEmail: "privacy@databroker.example",
        isStatutoryCommenced: true,
      },
    ];

    const result = await defaultPrivacyEngine.analyzePrivacyFootprint(
      userId,
      inputs,
      existingLegalRequests
    );

    // 1. Unified Findings
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((f) => f.category === "PRIVACY")).toBe(true);

    const unsubFinding = result.findings.find((f) => f.subcategory === "UNSUBSCRIBE_RADAR");
    expect(unsubFinding).toBeDefined();
    expect(unsubFinding?.payload.category).toBe("PRIVACY");

    const trackerFinding = result.findings.find((f) => f.subcategory === "EMAIL_TRACKING");
    expect(trackerFinding).toBeDefined();

    const cleanupFinding = result.findings.find((f) => f.subcategory === "ACCOUNT_CLEANUP");
    expect(cleanupFinding).toBeDefined();

    // 2. Entities & Relationships
    expect(result.entities.length).toBeGreaterThan(0);
    const rootEntity = result.entities.find((e) => e.type === "EMAIL_IDENTITY");
    expect(rootEntity).toBeDefined();
    expect(result.relationships.length).toBeGreaterThan(0);

    // 3. Candidates and Trackers
    expect(result.unsubscribeCandidates.length).toBe(1);
    expect(result.unsubscribeCandidates[0].mechanism).toBe("RFC_8058_POST");
    expect(result.trackerDetections.length).toBe(1);
    expect(result.oauthApps.length).toBe(1);

    // 4. Summary & Privacy Health Score
    expect(result.summary.totalMarketingSenders).toBe(1);
    expect(result.summary.rfc8058EligibleCount).toBe(1);
    expect(result.summary.totalTrackersDetected).toBeGreaterThan(0);
    expect(result.summary.privacyHealthScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.privacyHealthScore).toBeLessThanOrEqual(100);
  });

  it("maintains backwards compatibility with evaluatePrivacyStatus()", async () => {
    const result = await defaultPrivacyEngine.evaluatePrivacyStatus([
      {
        userId: "user_a",
        domain: "marketinghub.com",
        displayName: "Marketing Hub",
        emailCount: 5,
        daysAgo: 200,
        hasUnsubscribeHeader: true,
        isBulkMail: true,
      },
    ]);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.summary.discoveredAccountsCount).toBe(1);
  });
});
