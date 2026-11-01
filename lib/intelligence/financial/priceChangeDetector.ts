import { type ExtractedTransaction, type PriceChangeEvent } from "./financialTypes";
import { MerchantNormalizer } from "./merchantNormalizer";

export class PriceChangeDetector {
  /**
   * Compares chronological transactions for each merchant to identify price changes.
   */
  static detectPriceChanges(transactions: ExtractedTransaction[]): PriceChangeEvent[] {
    // Filter to transactions with valid positive amounts
    const validTxs = transactions.filter(
      (t) => typeof t.amount === "number" && t.amount > 0 && t.currency
    );

    // Group by merchant and currency
    const groups = new Map<string, ExtractedTransaction[]>();
    for (const tx of validTxs) {
      const norm = MerchantNormalizer.normalize(tx.senderDomain, tx.merchantName);
      const key = `${norm.canonicalDomain}::${tx.currency}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    }

    const priceAlerts: PriceChangeEvent[] = [];

    for (const [key, txList] of groups.entries()) {
      if (txList.length < 2) continue;

      // Sort chronologically ascending
      txList.sort(
        (a, b) =>
          new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );

      // Check consecutive transactions for price changes
      for (let i = 1; i < txList.length; i++) {
        const prev = txList[i - 1];
        const curr = txList[i];

        if (prev.amount === undefined || curr.amount === undefined) continue;

        // Skip identical amounts
        if (Math.abs(curr.amount - prev.amount) < 0.01) continue;

        const [canonicalDomain, currency] = key.split("::");
        const norm = MerchantNormalizer.normalize(curr.senderDomain, curr.merchantName);

        // Detect frequency shifts (e.g. Monthly -> Annual)
        const prevFreq = prev.billingFrequency || "UNKNOWN";
        const currFreq = curr.billingFrequency || "UNKNOWN";
        const isFreqShift = prevFreq !== "UNKNOWN" && currFreq !== "UNKNOWN" && prevFreq !== currFreq;

        // Check if ratio suggests monthly to annual conversion (e.g. ~10x - 14x increase)
        const ratio = curr.amount / prev.amount;
        const looksLikeAnnualShift = ratio >= 8 && ratio <= 15;

        let isAmbiguous = false;
        let ambiguityReason: string | undefined = undefined;

        if (isFreqShift || looksLikeAnnualShift) {
          isAmbiguous = true;
          ambiguityReason =
            isFreqShift
              ? `Billing cadence changed from ${prevFreq} to ${currFreq}. This may reflect a plan switch rather than a pure price hike.`
              : `Amount jump (~${Math.round(ratio)}x) appears to be an annual renewal conversion rather than a direct rate increase.`;
        }

        const absoluteChange = Math.round((curr.amount - prev.amount) * 100) / 100;
        const percentageChange =
          Math.round(((curr.amount - prev.amount) / prev.amount) * 1000) / 10; // 1 decimal place

        const alertId = `prc_${canonicalDomain.replace(/[^a-z0-9]/gi, "_")}_${curr.id}`;

        priceAlerts.push({
          id: alertId,
          merchantName: norm.canonicalName,
          canonicalDomain,
          currency: currency as PriceChangeEvent["currency"],
          previousAmount: prev.amount,
          newAmount: curr.amount,
          absoluteChange,
          percentageChange,
          effectiveDate: curr.transactionDate,
          billingFrequency: currFreq !== "UNKNOWN" ? currFreq : prevFreq,
          isAmbiguous,
          ambiguityReason,
          confidence: isAmbiguous ? 0.65 : 0.90,
          evidenceIds: [prev.id, curr.id],
        });
      }
    }

    return priceAlerts;
  }
}
