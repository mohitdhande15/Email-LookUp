import { CurrencyNormalizer } from "./currencyNormalizer";
import {
  type ExtractedTransaction,
  type SubscriptionRecord,
  type FinancialSummary,
  type MerchantSpendingSummary,
  type BillingFrequency,
  type CurrencyCode,
} from "./financialTypes";

export class RecurringPaymentAnalyzer {
  /**
   * Deduplicates transactions when both invoice and payment receipt exist for the same event.
   */
  static deduplicateTransactions(transactions: ExtractedTransaction[]): ExtractedTransaction[] {
    const seen = new Map<string, ExtractedTransaction>();

    for (const tx of transactions) {
      if (!tx.amount || !tx.currency) {
        seen.set(tx.id, tx);
        continue;
      }

      // Group key: merchant + amount + currency + date (day granularity)
      const day = tx.transactionDate.slice(0, 10);
      const key = `${tx.merchantName.toLowerCase()}::${tx.amount}::${tx.currency}::${day}`;

      if (seen.has(key)) {
        const existing = seen.get(key)!;
        // Prefer CONFIRMED_PAID over INVOICED_ONLY
        if (tx.paymentStatus === "CONFIRMED_PAID" && existing.paymentStatus !== "CONFIRMED_PAID") {
          seen.set(key, tx);
        }
      } else {
        seen.set(key, tx);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Analyzes subscriptions and transactions to generate a full FinancialSummary.
   */
  static generateSummary(
    subscriptions: SubscriptionRecord[],
    transactions: ExtractedTransaction[],
    trialsCount: number,
    priceHikesCount: number,
    preferredCurrency: CurrencyCode = "USD"
  ): FinancialSummary {
    const dedupedTxs = this.deduplicateTransactions(transactions);

    let monthlyTotal = 0;
    let annualTotal = 0;

    const spendingByMerchant: MerchantSpendingSummary[] = [];
    const spendingByCurrency: Record<string, number> = {};
    const spendingByCategory: Record<string, number> = {};
    const billingFrequencyDistribution: Record<BillingFrequency, number> = {
      MONTHLY: 0,
      ANNUAL: 0,
      QUARTERLY: 0,
      WEEKLY: 0,
      ONE_OFF: 0,
      UNKNOWN: 0,
    };

    // Aggregate active subscriptions
    for (const sub of subscriptions) {
      // Convert to preferred currency for unified totals
      const normalizedMonthly =
        preferredCurrency === "INR"
          ? CurrencyNormalizer.convertToEstimatedINR(sub.estimatedMonthlyCost, sub.currency)
          : CurrencyNormalizer.convertToEstimatedUSD(sub.estimatedMonthlyCost, sub.currency);

      const normalizedAnnual =
        preferredCurrency === "INR"
          ? CurrencyNormalizer.convertToEstimatedINR(sub.estimatedAnnualCost, sub.currency)
          : CurrencyNormalizer.convertToEstimatedUSD(sub.estimatedAnnualCost, sub.currency);

      monthlyTotal += normalizedMonthly;
      annualTotal += normalizedAnnual;

      // Currency breakdown
      spendingByCurrency[sub.currency] =
        (spendingByCurrency[sub.currency] || 0) + sub.estimatedMonthlyCost;

      // Category breakdown
      spendingByCategory[sub.category] =
        (spendingByCategory[sub.category] || 0) + normalizedMonthly;

      // Billing frequency count
      const freq = sub.billingFrequency || "UNKNOWN";
      billingFrequencyDistribution[freq] = (billingFrequencyDistribution[freq] || 0) + 1;

      spendingByMerchant.push({
        merchantName: sub.merchantName,
        canonicalDomain: sub.canonicalDomain,
        category: sub.category,
        billingFrequency: sub.billingFrequency,
        currency: sub.currency,
        monthlyCost: sub.estimatedMonthlyCost,
        annualCost: sub.estimatedAnnualCost,
        transactionCount: sub.transactionCount,
      });
    }

    // Historical spending trend by month (YYYY-MM)
    const monthMap = new Map<string, number>();
    for (const tx of dedupedTxs) {
      if (typeof tx.amount === "number" && tx.amount > 0 && tx.currency) {
        const monthKey = tx.transactionDate.slice(0, 7); // YYYY-MM
        const normalizedAmount =
          preferredCurrency === "INR"
            ? CurrencyNormalizer.convertToEstimatedINR(tx.amount, tx.currency)
            : CurrencyNormalizer.convertToEstimatedUSD(tx.amount, tx.currency);

        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + normalizedAmount);
      }
    }

    const historicalSpendingTrend = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month,
        total: Math.round(total * 100) / 100,
        currency: preferredCurrency,
      }));

    return {
      estimatedMonthlyRecurringCost: Math.round(monthlyTotal * 100) / 100,
      estimatedAnnualRecurringCost: Math.round(annualTotal * 100) / 100,
      totalActiveSubscriptions: subscriptions.length,
      activeTrialsCount: trialsCount,
      priceHikeAlertsCount: priceHikesCount,
      primaryCurrency: preferredCurrency,
      spendingByMerchant: spendingByMerchant.sort((a, b) => b.monthlyCost - a.monthlyCost),
      spendingByCurrency,
      spendingByCategory,
      billingFrequencyDistribution,
      historicalSpendingTrend,
    };
  }
}
