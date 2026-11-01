import { describe, it, expect } from "vitest";
import { TrialDetector } from "@/lib/intelligence/financial/trialDetector";
import { type ExtractedTransaction } from "@/lib/intelligence/financial/financialTypes";

describe("TrialDetector", () => {
  it("detects free trial activation and extracts trial duration", () => {
    const txs: ExtractedTransaction[] = [
      {
        id: "tx_trial_1",
        merchantName: "Notion",
        senderDomain: "notion.so",
        emailSubject: "Welcome to your 14-day free trial of Notion AI",
        transactionDate: "2026-10-25T10:00:00Z",
        documentType: "TRIAL_CONFIRMATION",
        paymentStatus: "INVOICED_ONLY",
        isTrialEvent: true,
        evidenceSnippet: "Enjoy 14 days free. After that, you will be billed $10.00/month.",
      },
    ];

    const trials = TrialDetector.detectTrials(txs);
    expect(trials).toHaveLength(1);
    expect(trials[0].serviceName).toBe("Notion");
    expect(trials[0].expectedPostTrialAmount).toBe(10.00);
    expect(trials[0].status).toBe("ACTIVE");
    expect(trials[0].cancellationUrl).toContain("notion.so");
  });

  it("detects trial cancellation and updates status", () => {
    const txs: ExtractedTransaction[] = [
      {
        id: "tx_trial_start",
        merchantName: "Adobe Creative Cloud",
        senderDomain: "adobe.com",
        emailSubject: "Your 7-day free trial has started",
        transactionDate: "2026-10-10T10:00:00Z",
        documentType: "TRIAL_CONFIRMATION",
        paymentStatus: "INVOICED_ONLY",
        isTrialEvent: true,
      },
      {
        id: "tx_trial_cancel",
        merchantName: "Adobe Creative Cloud",
        senderDomain: "adobe.com",
        emailSubject: "Confirmation: You cancelled your trial",
        transactionDate: "2026-10-12T15:00:00Z",
        documentType: "TRIAL_CANCELLATION",
        paymentStatus: "INVOICED_ONLY",
        isTrialEvent: true,
      },
    ];

    const trials = TrialDetector.detectTrials(txs);
    expect(trials).toHaveLength(1);
    expect(trials[0].status).toBe("CANCELLED");
    expect(trials[0].verificationStatus).toBe("CONFIRMED_FACT");
  });
});
