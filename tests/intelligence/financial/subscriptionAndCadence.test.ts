import { describe, it, expect } from "vitest";
import { SubscriptionDetector } from "@/lib/intelligence/financial/subscriptionDetector";
import { RecurringPaymentAnalyzer } from "@/lib/intelligence/financial/recurringPaymentAnalyzer";
import { type ExtractedTransaction } from "@/lib/intelligence/financial/financialTypes";

describe("SubscriptionDetector & Cadence", () => {
  it("deduces monthly cadence from consecutive transactions spaced ~30 days apart", () => {
    const txs: ExtractedTransaction[] = [
      {
        id: "tx_1",
        merchantName: "Spotify",
        senderDomain: "spotify.com",
        emailSubject: "Your Spotify receipt: $10.99",
        transactionDate: "2026-08-10T10:00:00Z",
        amount: 10.99,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
      },
      {
        id: "tx_2",
        merchantName: "Spotify",
        senderDomain: "spotify.com",
        emailSubject: "Your Spotify receipt: $10.99",
        transactionDate: "2026-09-10T10:00:00Z",
        amount: 10.99,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
      },
      {
        id: "tx_3",
        merchantName: "Spotify",
        senderDomain: "spotify.com",
        emailSubject: "Your Spotify receipt: $10.99",
        transactionDate: "2026-10-10T10:00:00Z",
        amount: 10.99,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
      },
    ];

    const subs = SubscriptionDetector.evaluateMerchantSubscriptions(txs);
    expect(subs).toHaveLength(1);
    expect(subs[0].billingFrequency).toBe("MONTHLY");
    expect(subs[0].estimatedMonthlyCost).toBe(10.99);
    expect(subs[0].estimatedAnnualCost).toBe(131.88);
    expect(subs[0].verificationStatus).toBe("CONFIRMED_FACT");
    expect(subs[0].nextRenewalDate).toBeDefined();
  });

  it("calculates annual subscription recurring costs accurately", () => {
    const { monthly, annual } = SubscriptionDetector.calculateRecurringCosts(120, "ANNUAL");
    expect(monthly).toBe(10.00);
    expect(annual).toBe(120.00);
  });

  it("deduplicates identical invoice and payment receipt transactions", () => {
    const rawTxs: ExtractedTransaction[] = [
      {
        id: "tx_inv",
        merchantName: "GitHub",
        senderDomain: "github.com",
        emailSubject: "Invoice #GH-112: $21.00",
        transactionDate: "2026-10-01T12:00:00Z",
        amount: 21.00,
        currency: "USD",
        documentType: "INVOICE",
        paymentStatus: "INVOICED_ONLY",
      },
      {
        id: "tx_paid",
        merchantName: "GitHub",
        senderDomain: "github.com",
        emailSubject: "Payment receipt for GitHub: $21.00",
        transactionDate: "2026-10-01T12:05:00Z",
        amount: 21.00,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
      },
    ];

    const deduped = RecurringPaymentAnalyzer.deduplicateTransactions(rawTxs);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].paymentStatus).toBe("CONFIRMED_PAID");
  });
});
