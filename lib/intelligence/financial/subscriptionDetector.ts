import { MerchantNormalizer } from "./merchantNormalizer";
import { CurrencyNormalizer } from "./currencyNormalizer";
import {
  type ExtractedTransaction,
  type SubscriptionRecord,
  type BillingFrequency,
  type CurrencyCode,
} from "./financialTypes";
import { type VerificationStatus } from "../core/confidence";
import { type FindingSeverity } from "../core/finding";

export class SubscriptionDetector {
  /**
   * Evaluates a collection of extracted transactions for a single merchant
   * and determines whether they constitute an active subscription.
   */
  static evaluateMerchantSubscriptions(
    merchantTransactions: ExtractedTransaction[]
  ): SubscriptionRecord[] {
    if (!merchantTransactions.length) return [];

    // Group by currency to prevent cross-currency distortion
    const currencyGroups = new Map<CurrencyCode, ExtractedTransaction[]>();
    for (const tx of merchantTransactions) {
      const curr = tx.currency || "USD";
      if (!currencyGroups.has(curr)) {
        currencyGroups.set(curr, []);
      }
      currencyGroups.get(curr)!.push(tx);
    }

    const subscriptions: SubscriptionRecord[] = [];

    for (const [currency, txs] of currencyGroups.entries()) {
      // Sort chronologically ascending
      txs.sort(
        (a, b) =>
          new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );

      const firstTx = txs[0];
      const lastTx = txs[txs.length - 1];
      const norm = MerchantNormalizer.normalize(lastTx.senderDomain, lastTx.merchantName);

      // Determine frequency
      const frequency = this.deduceBillingFrequency(txs);

      // Use latest valid transaction amount or median
      const validAmounts = txs.map((t) => t.amount).filter((a): a is number => typeof a === "number" && a > 0);
      const lastAmount = validAmounts.length ? validAmounts[validAmounts.length - 1] : 0;

      // Estimate monthly and annual recurring costs
      const { monthly, annual } = this.calculateRecurringCosts(lastAmount, frequency);

      // Determine confidence & verification status
      const { confidence, verificationStatus } = this.scoreSubscriptionConfidence(
        txs,
        norm.isKnownSubscriptionMerchant
      );

      // Determine next renewal date
      const nextRenewalDate = this.estimateNextRenewal(lastTx.transactionDate, frequency);

      // Determine severity based on cost
      const monthlyUSD = CurrencyNormalizer.convertToEstimatedUSD(monthly, currency);
      let severity: FindingSeverity = "INFO";
      if (monthlyUSD > 50) severity = "HIGH";
      else if (monthlyUSD > 20) severity = "MEDIUM";
      else severity = "LOW";

      subscriptions.push({
        id: `sub_${norm.canonicalDomain.replace(/[^a-z0-9]/gi, "_")}_${currency.toLowerCase()}`,
        merchantName: norm.canonicalName,
        canonicalDomain: norm.canonicalDomain,
        category: norm.category,
        billingFrequency: frequency,
        currency,
        lastAmount,
        estimatedMonthlyCost: monthly,
        estimatedAnnualCost: annual,
        firstDetectedDate: firstTx.transactionDate,
        lastDetectedDate: lastTx.transactionDate,
        nextRenewalDate,
        transactionCount: txs.length,
        confidence,
        verificationStatus,
        severity,
        evidenceIds: txs.map((t) => t.id),
        cancellationUrl: norm.defaultCancellationUrl,
      });
    }

    return subscriptions;
  }

  /**
   * Deduces billing frequency from explicit tags or interval between recurring transactions.
   */
  static deduceBillingFrequency(txs: ExtractedTransaction[]): BillingFrequency {
    // Check explicit frequency on recent transactions
    for (let i = txs.length - 1; i >= 0; i--) {
      if (txs[i].billingFrequency && txs[i].billingFrequency !== "UNKNOWN") {
        return txs[i].billingFrequency!;
      }
    }

    if (txs.length < 2) {
      return "MONTHLY"; // Standard default for single subscription observations
    }

    // Compute intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      const prev = new Date(txs[i - 1].transactionDate).getTime();
      const curr = new Date(txs[i].transactionDate).getTime();
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (days > 0) intervals.push(days);
    }

    if (!intervals.length) return "MONTHLY";
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avgInterval >= 25 && avgInterval <= 35) return "MONTHLY";
    if (avgInterval >= 80 && avgInterval <= 100) return "QUARTERLY";
    if (avgInterval >= 340 && avgInterval <= 390) return "ANNUAL";
    if (avgInterval >= 6 && avgInterval <= 8) return "WEEKLY";

    return "MONTHLY";
  }

  /**
   * Calculates estimated monthly and annual costs based on billing cadence.
   */
  static calculateRecurringCosts(
    amount: number,
    frequency: BillingFrequency
  ): { monthly: number; annual: number } {
    if (amount <= 0) return { monthly: 0, annual: 0 };

    switch (frequency) {
      case "ANNUAL":
        return {
          monthly: Math.round((amount / 12) * 100) / 100,
          annual: amount,
        };
      case "QUARTERLY":
        return {
          monthly: Math.round((amount / 3) * 100) / 100,
          annual: Math.round(amount * 4 * 100) / 100,
        };
      case "WEEKLY":
        return {
          monthly: Math.round(amount * 4.33 * 100) / 100,
          annual: Math.round(amount * 52 * 100) / 100,
        };
      case "MONTHLY":
      default:
        return {
          monthly: amount,
          annual: Math.round(amount * 12 * 100) / 100,
        };
    }
  }

  /**
   * Assigns confidence and epistemic verification status.
   */
  static scoreSubscriptionConfidence(
    txs: ExtractedTransaction[],
    isKnownVendor: boolean
  ): { confidence: number; verificationStatus: VerificationStatus } {
    const hasPaidReceipt = txs.some((t) => t.paymentStatus === "CONFIRMED_PAID");

    if (txs.length >= 2 && hasPaidReceipt) {
      return { confidence: 0.95, verificationStatus: "CONFIRMED_FACT" };
    }
    if (isKnownVendor && hasPaidReceipt) {
      return { confidence: 0.85, verificationStatus: "HIGH_INFERENCE" };
    }
    if (isKnownVendor || hasPaidReceipt) {
      return { confidence: 0.70, verificationStatus: "HIGH_INFERENCE" };
    }
    if (txs.some((t) => t.documentType === "ORDER_CONFIRMATION" || t.documentType === "INVOICE")) {
      return { confidence: 0.50, verificationStatus: "LOW_INFERENCE" };
    }
    return { confidence: 0.30, verificationStatus: "UNVERIFIED" };
  }

  /**
   * Projects the next renewal date based on billing cadence.
   */
  static estimateNextRenewal(lastDateStr: string, frequency: BillingFrequency): string | undefined {
    try {
      const d = new Date(lastDateStr);
      if (isNaN(d.getTime())) return undefined;

      const next = new Date(d);
      switch (frequency) {
        case "ANNUAL":
          next.setFullYear(next.getFullYear() + 1);
          break;
        case "QUARTERLY":
          next.setMonth(next.getMonth() + 3);
          break;
        case "WEEKLY":
          next.setDate(next.getDate() + 7);
          break;
        case "MONTHLY":
        default:
          next.setMonth(next.getMonth() + 1);
          break;
      }
      return next.toISOString();
    } catch {
      return undefined;
    }
  }
}
