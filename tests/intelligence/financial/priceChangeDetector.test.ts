import { describe, it, expect } from "vitest";
import { PriceChangeDetector } from "@/lib/intelligence/financial/priceChangeDetector";
import { type ExtractedTransaction } from "@/lib/intelligence/financial/financialTypes";

describe("PriceChangeDetector", () => {
  it("detects genuine recurring price increases", () => {
    const txs: ExtractedTransaction[] = [
      {
        id: "tx_old",
        merchantName: "Netflix",
        senderDomain: "netflix.com",
        emailSubject: "Your Netflix receipt: $15.49",
        transactionDate: "2026-08-01T12:00:00Z",
        amount: 15.49,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
        billingFrequency: "MONTHLY",
      },
      {
        id: "tx_new",
        merchantName: "Netflix",
        senderDomain: "netflix.com",
        emailSubject: "Your Netflix receipt: $17.99",
        transactionDate: "2026-09-01T12:00:00Z",
        amount: 17.99,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
        billingFrequency: "MONTHLY",
      },
    ];

    const alerts = PriceChangeDetector.detectPriceChanges(txs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].merchantName).toBe("Netflix");
    expect(alerts[0].previousAmount).toBe(15.49);
    expect(alerts[0].newAmount).toBe(17.99);
    expect(alerts[0].percentageChange).toBe(16.1);
    expect(alerts[0].isAmbiguous).toBe(false);
  });

  it("flags annual plan shifts as ambiguous to prevent false price-hike alarms", () => {
    const txs: ExtractedTransaction[] = [
      {
        id: "tx_month",
        merchantName: "Linear",
        senderDomain: "linear.app",
        emailSubject: "Linear Monthly receipt: $12.00",
        transactionDate: "2026-07-01T10:00:00Z",
        amount: 12.00,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
        billingFrequency: "MONTHLY",
      },
      {
        id: "tx_annual",
        merchantName: "Linear",
        senderDomain: "linear.app",
        emailSubject: "Linear Annual Subscription: $120.00",
        transactionDate: "2026-08-01T10:00:00Z",
        amount: 120.00,
        currency: "USD",
        documentType: "PAYMENT_RECEIPT",
        paymentStatus: "CONFIRMED_PAID",
        billingFrequency: "ANNUAL",
      },
    ];

    const alerts = PriceChangeDetector.detectPriceChanges(txs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].isAmbiguous).toBe(true);
    expect(alerts[0].ambiguityReason).toContain("cadence changed");
  });
});
