import { MerchantNormalizer } from "./merchantNormalizer";
import { CurrencyNormalizer } from "./currencyNormalizer";
import { type ExtractedTransaction, type TrialRecord } from "./financialTypes";
import { type VerificationStatus } from "../core/confidence";

export class TrialDetector {
  /**
   * Scans transactions for free trial events and constructs TrialRecord entries.
   */
  static detectTrials(transactions: ExtractedTransaction[]): TrialRecord[] {
    const trialTxs = transactions.filter(
      (t) =>
        t.isTrialEvent ||
        t.documentType === "TRIAL_CONFIRMATION" ||
        t.documentType === "TRIAL_CANCELLATION" ||
        /free trial|trial started|trial ending/i.test(t.emailSubject)
    );

    if (!trialTxs.length) return [];

    // Group by merchant
    const merchantMap = new Map<string, ExtractedTransaction[]>();
    for (const tx of trialTxs) {
      if (!merchantMap.has(tx.merchantName)) {
        merchantMap.set(tx.merchantName, []);
      }
      merchantMap.get(tx.merchantName)!.push(tx);
    }

    const trials: TrialRecord[] = [];

    for (const [merchant, txs] of merchantMap.entries()) {
      // Sort newest first
      txs.sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
      );

      const latestTx = txs[0];
      const norm = MerchantNormalizer.normalize(latestTx.senderDomain, merchant);

      // Check if cancelled
      const isCancelled = txs.some(
        (t) =>
          t.documentType === "TRIAL_CANCELLATION" ||
          /cancel(?:led|ed) your trial|trial cancel/i.test(t.emailSubject)
      );

      // Extract trial start and expiration
      const startDate = latestTx.transactionDate;
      const { expiryDate, isExplicitExpiry } = this.extractExpirationDate(
        latestTx.emailSubject,
        latestTx.evidenceSnippet || "",
        startDate
      );

      // Calculate days remaining
      const now = new Date();
      const expiry = new Date(expiryDate);
      const diffMs = expiry.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED" = "ACTIVE";
      if (isCancelled) {
        status = "CANCELLED";
      } else if (daysRemaining <= 0) {
        status = "EXPIRED";
      } else if (daysRemaining <= 3) {
        status = "EXPIRING_SOON";
      }

      // Check post-trial expected amount
      const postTrialMonetary =
        CurrencyNormalizer.parseMonetaryAmount(latestTx.emailSubject) ||
        (latestTx.evidenceSnippet
          ? CurrencyNormalizer.parseMonetaryAmount(latestTx.evidenceSnippet)
          : null);

      let verificationStatus: VerificationStatus = "HIGH_INFERENCE";
      let confidence = 0.85;

      if (!isExplicitExpiry) {
        verificationStatus = "LOW_INFERENCE";
        confidence = 0.60;
      }
      if (isCancelled) {
        verificationStatus = "CONFIRMED_FACT";
        confidence = 0.95;
      }

      trials.push({
        id: `trial_${norm.canonicalDomain.replace(/[^a-z0-9]/gi, "_")}`,
        serviceName: norm.canonicalName,
        canonicalDomain: norm.canonicalDomain,
        trialStartDate: startDate,
        trialExpirationDate: expiryDate,
        daysRemaining: Math.max(-999, daysRemaining),
        expectedPostTrialAmount: postTrialMonetary?.amount,
        currency: postTrialMonetary?.currency,
        cancellationUrl: norm.defaultCancellationUrl,
        cancellationGuide: `To cancel your ${norm.canonicalName} trial, visit ${norm.defaultCancellationUrl || `https://${norm.canonicalDomain}`} and navigate to Billing or Subscription settings before the renewal date.`,
        status,
        confidence,
        verificationStatus,
        evidenceIds: txs.map((t) => t.id),
      });
    }

    return trials;
  }

  /**
   * Attempts to deterministically extract trial duration or expiration date.
   * If explicit duration is found (e.g. "7-day free trial"), adds to startDate.
   * Otherwise defaults to 14 days from startDate with isExplicitExpiry = false.
   */
  static extractExpirationDate(
    subject: string,
    snippet: string,
    startDateStr: string
  ): { expiryDate: string; isExplicitExpiry: boolean } {
    const text = `${subject} ${snippet}`;
    const start = new Date(startDateStr);

    // Explicit days match: "7-day free trial", "14 days free", "30-day trial"
    const durationMatch = text.match(/\b([0-9]{1,3})[ -]?(?:day|days)[ -]?(?:free)?(?:[ -]?trial)?\b/i);
    if (durationMatch && durationMatch[1]) {
      const days = parseInt(durationMatch[1], 10);
      if (!isNaN(days) && days > 0 && days <= 365) {
        const expiry = new Date(start);
        expiry.setDate(expiry.getDate() + days);
        return { expiryDate: expiry.toISOString(), isExplicitExpiry: true };
      }
    }

    // Explicit month match: "1 month free trial", "3 months free"
    const monthMatch = text.match(/\b([0-9]{1,2})[ -]?(?:month|months)[ -]?(?:free)?(?:[ -]?trial)?\b/i);
    if (monthMatch && monthMatch[1]) {
      const months = parseInt(monthMatch[1], 10);
      if (!isNaN(months) && months > 0 && months <= 12) {
        const expiry = new Date(start);
        expiry.setMonth(expiry.getMonth() + months);
        return { expiryDate: expiry.toISOString(), isExplicitExpiry: true };
      }
    }

    // Fallback: 14-day heuristic, flagged as not explicit
    const fallbackExpiry = new Date(start);
    fallbackExpiry.setDate(fallbackExpiry.getDate() + 14);
    return {
      expiryDate: fallbackExpiry.toISOString(),
      isExplicitExpiry: false,
    };
  }
}
