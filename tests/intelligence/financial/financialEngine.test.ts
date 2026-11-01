import { describe, it, expect } from "vitest";
import { defaultFinancialEngine } from "@/lib/intelligence/financial/financialEngine";
import { defaultRecommendationEngine } from "@/lib/intelligence/recommendations/recommendationEngine";
import { type RawEmailFinancialInput } from "@/lib/intelligence/financial/transactionExtractor";

describe("FinancialEngine Integration", () => {
  it("processes synthetic candidate emails into unified findings, graph entities, and evidence", async () => {
    const rawInputs: RawEmailFinancialInput[] = [
      // Subscription transactions
      {
        messageId: "msg_netflix_1",
        senderDomain: "netflix.com",
        senderDisplayName: "Netflix",
        subject: "Your receipt for Netflix: $15.49",
        dateStr: "2026-08-01T12:00:00Z",
        snippet: "Your monthly plan renewed successfully.",
      },
      {
        messageId: "msg_netflix_2",
        senderDomain: "netflix.com",
        senderDisplayName: "Netflix",
        subject: "Your receipt for Netflix: $15.49",
        dateStr: "2026-09-01T12:00:00Z",
        snippet: "Your monthly plan renewed successfully.",
      },
      // Free trial
      {
        messageId: "msg_notion_trial",
        senderDomain: "notion.so",
        senderDisplayName: "Notion",
        subject: "Welcome to your 14-day free trial of Notion AI",
        dateStr: "2026-10-25T10:00:00Z",
        snippet: "14 days free trial. After trial, $10.00/month.",
      },
      // Price change
      {
        messageId: "msg_spotify_1",
        senderDomain: "spotify.com",
        senderDisplayName: "Spotify",
        subject: "Spotify Premium Receipt: $9.99",
        dateStr: "2026-08-15T10:00:00Z",
      },
      {
        messageId: "msg_spotify_2",
        senderDomain: "spotify.com",
        senderDisplayName: "Spotify",
        subject: "Spotify Premium Receipt: $11.99",
        dateStr: "2026-09-15T10:00:00Z",
      },
    ];

    const result = await defaultFinancialEngine.analyzeTransactions("test_user_001", rawInputs, "USD");

    // Check Subscriptions
    expect(result.subscriptions.length).toBeGreaterThanOrEqual(2);
    const netflixSub = result.subscriptions.find((s) => s.merchantName === "Netflix");
    expect(netflixSub).toBeDefined();
    expect(netflixSub?.billingFrequency).toBe("MONTHLY");
    expect(netflixSub?.estimatedMonthlyCost).toBe(15.49);

    // Check Trials
    expect(result.trials).toHaveLength(1);
    expect(result.trials[0].serviceName).toBe("Notion");
    expect(result.trials[0].status).toBe("ACTIVE");

    // Check Price Alerts
    const spotifyAlert = result.priceAlerts.find((p) => p.merchantName === "Spotify");
    expect(spotifyAlert).toBeDefined();
    expect(spotifyAlert?.previousAmount).toBe(9.99);
    expect(spotifyAlert?.newAmount).toBe(11.99);

    // Check Unified Findings
    expect(result.findings.length).toBeGreaterThanOrEqual(4);
    for (const finding of result.findings) {
      expect(finding.category).toBe("FINANCIAL");
      expect(finding.userId).toBe("test_user_001");
      expect(finding.evidence).toBeDefined();
    }

    // Check Graph Entities & Relationships
    const subscriptionEntities = result.entities.filter((e) => e.type === "SUBSCRIPTION");
    expect(subscriptionEntities.length).toBeGreaterThanOrEqual(2);

    const subscriptionRels = result.relationships.filter((r) => r.type === "SUBSCRIBED_TO");
    expect(subscriptionRels.length).toBeGreaterThanOrEqual(2);

    // Check Evidence Items
    expect(result.evidence.length).toBe(rawInputs.length);
    for (const ev of result.evidence) {
      expect(ev.type).toBe("MAILBOX_HEADER");
      expect(ev.provenance.fingerprint).toBeDefined();
    }

    // Check Recommendations
    const actionPlan = defaultRecommendationEngine.generateActionPlan(result.findings);
    expect(actionPlan.length).toBeGreaterThan(0);
    expect(actionPlan.some((a) => a.type === "CANCEL_SUBSCRIPTION")).toBe(true);
  });
});
