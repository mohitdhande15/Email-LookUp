import { type CurrencyCode, type MonetaryAmount } from "./financialTypes";

// Baseline conversion rates for aggregated summary estimations.
// Note: Actual transactions always retain their pristine original currency and amount.
const BASELINE_RATES_TO_USD: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  INR: 0.012, // ~83.3 INR per USD
  CAD: 0.74,
  AUD: 0.66,
  SGD: 0.75,
  JPY: 0.0067, // ~150 JPY per USD
  OTHER: 1.0,
  UNKNOWN: 1.0,
};

const BASELINE_RATES_TO_INR: Record<CurrencyCode, number> = {
  INR: 1.0,
  USD: 83.3,
  EUR: 90.0,
  GBP: 106.5,
  CAD: 61.5,
  AUD: 55.0,
  SGD: 62.5,
  JPY: 0.56,
  OTHER: 83.3,
  UNKNOWN: 83.3,
};

export class CurrencyNormalizer {
  /**
   * Detects currency code from text, symbol, or ISO abbreviation.
   */
  static detectCurrency(text: string): CurrencyCode {
    const upper = text.toUpperCase();

    // Check specific national currency variants first before generic $
    if (text.includes("₹") || /\b(?:RS\.?|INR)\b/i.test(text)) return "INR";
    if (text.includes("£") || /\bGBP\b/i.test(text)) return "GBP";
    if (text.includes("€") || /\bEUR\b/i.test(text)) return "EUR";
    if (text.includes("¥") || /\bJPY\b/i.test(text)) return "JPY";
    if (/(?:C\$|\bCAD\b)/i.test(text)) return "CAD";
    if (/(?:A\$|\bAUD\b)/i.test(text)) return "AUD";
    if (/(?:S\$|\bSGD\b)/i.test(text)) return "SGD";
    if (text.includes("$") || /\bUSD\b/i.test(text)) return "USD";

    // General code checks
    if (/\bCHF\b/i.test(upper)) return "OTHER";
    if (/\bBRL\b/i.test(upper)) return "OTHER";

    return "UNKNOWN";
  }

  /**
   * Parses monetary amounts from text fragments.
   * Handles international comma/dot separators:
   * e.g., "$1,299.99", "₹ 1,49,999.00", "€ 49,90", "£12.50", "USD 99.00".
   */
  static parseMonetaryAmount(text: string): MonetaryAmount | null {
    if (!text) return null;

    // Pattern 1: Symbol/Code followed by amount
    const prefixRegex =
      /(?:(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP|¥|JPY|C\$|CAD|A\$|AUD|S\$|SGD)\s*([0-9]{1,3}(?:[0-9,.]*[0-9])|[0-9]+))/i;

    // Pattern 2: Amount followed by Symbol/Code
    const suffixRegex =
      /([0-9]{1,3}(?:[0-9,.]*[0-9])|[0-9]+)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP|¥|JPY|CAD|AUD|SGD|EUR)/i;

    let currencyMatch: string | null = null;
    let numberMatch: string | null = null;

    const matchPrefix = text.match(prefixRegex);
    if (matchPrefix) {
      currencyMatch = matchPrefix[1];
      numberMatch = matchPrefix[2];
    } else {
      const matchSuffix = text.match(suffixRegex);
      if (matchSuffix) {
        numberMatch = matchSuffix[1];
        currencyMatch = matchSuffix[2];
      }
    }

    if (!numberMatch) return null;

    const currency = currencyMatch ? this.detectCurrency(currencyMatch) : "UNKNOWN";
    const amount = this.parseNumericValue(numberMatch);

    if (amount === null || isNaN(amount) || amount <= 0) return null;

    return {
      amount,
      currency,
      rawString: `${currencyMatch || ""} ${numberMatch}`.trim(),
    };
  }

  /**
   * Normalizes numeric string to standard float:
   * e.g. "1,299.50" -> 1299.50
   * e.g. "1.299,50" -> 1299.50
   * e.g. "1,49,999.00" -> 149999.00
   * e.g. "49,90" -> 49.90
   */
  static parseNumericValue(numStr: string): number | null {
    if (!numStr) return null;
    const clean = numStr.trim();

    // Check European format: e.g. "1.299,50" or "49,90" (comma as decimal separator)
    if (/^[0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})$/.test(clean) || /^[0-9]+,[0-9]{2}$/.test(clean)) {
      const normalized = clean.replace(/\./g, "").replace(",", ".");
      const val = parseFloat(normalized);
      return isNaN(val) ? null : Math.round(val * 100) / 100;
    }

    // Standard US / UK / Indian format: remove commas, parse decimal point
    const standard = clean.replace(/,/g, "");
    const val = parseFloat(standard);
    return isNaN(val) ? null : Math.round(val * 100) / 100;
  }

  /**
   * Formats a monetary amount into a localized string with proper currency symbol.
   */
  static formatAmount(amount: number, currency: CurrencyCode): string {
    const symbols: Record<CurrencyCode, string> = {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CAD: "C$",
      AUD: "A$",
      SGD: "S$",
      OTHER: "",
      UNKNOWN: "",
    };

    const symbol = symbols[currency] || "";
    const formattedNum = amount.toLocaleString("en-US", {
      minimumFractionDigits: currency === "JPY" ? 0 : 2,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    });

    return symbol ? `${symbol}${formattedNum}` : `${formattedNum} ${currency}`;
  }

  /**
   * Converts any supported currency to estimated USD for normalized cross-currency aggregations.
   * Transaction records retain original currency and amount.
   */
  static convertToEstimatedUSD(amount: number, fromCurrency: CurrencyCode): number {
    const rate = BASELINE_RATES_TO_USD[fromCurrency] ?? 1.0;
    return Math.round(amount * rate * 100) / 100;
  }

  /**
   * Converts any supported currency to estimated INR for normalized cross-currency aggregations.
   */
  static convertToEstimatedINR(amount: number, fromCurrency: CurrencyCode): number {
    const rate = BASELINE_RATES_TO_INR[fromCurrency] ?? 83.3;
    return Math.round(amount * rate * 100) / 100;
  }
}
