import { describe, it, expect } from "vitest";
import { CurrencyNormalizer } from "@/lib/intelligence/financial/currencyNormalizer";

describe("CurrencyNormalizer", () => {
  it("detects international currencies accurately", () => {
    expect(CurrencyNormalizer.detectCurrency("₹ 1,499.00")).toBe("INR");
    expect(CurrencyNormalizer.detectCurrency("Your bill of Rs. 899 is ready")).toBe("INR");
    expect(CurrencyNormalizer.detectCurrency("$14.99 per month")).toBe("USD");
    expect(CurrencyNormalizer.detectCurrency("EUR 29.90 charged")).toBe("EUR");
    expect(CurrencyNormalizer.detectCurrency("€ 45,50")).toBe("EUR");
    expect(CurrencyNormalizer.detectCurrency("£9.99 paid")).toBe("GBP");
    expect(CurrencyNormalizer.detectCurrency("JPY 1,500")).toBe("JPY");
    expect(CurrencyNormalizer.detectCurrency("C$ 24.00")).toBe("CAD");
    expect(CurrencyNormalizer.detectCurrency("A$ 35.00")).toBe("AUD");
  });

  it("parses US and Indian formatted amounts", () => {
    const usd = CurrencyNormalizer.parseMonetaryAmount("Payment of $1,299.50 successful");
    expect(usd).not.toBeNull();
    expect(usd?.amount).toBe(1299.50);
    expect(usd?.currency).toBe("USD");

    const inr = CurrencyNormalizer.parseMonetaryAmount("Invoice for ₹ 1,49,999.00 generated");
    expect(inr).not.toBeNull();
    expect(inr?.amount).toBe(149999.00);
    expect(inr?.currency).toBe("INR");
  });

  it("parses European formatted comma decimals", () => {
    const eur = CurrencyNormalizer.parseMonetaryAmount("Total charged: 49,90 €");
    expect(eur).not.toBeNull();
    expect(eur?.amount).toBe(49.90);
    expect(eur?.currency).toBe("EUR");

    const eurThousand = CurrencyNormalizer.parseMonetaryAmount("€ 1.250,00");
    expect(eurThousand).not.toBeNull();
    expect(eurThousand?.amount).toBe(1250.00);
    expect(eurThousand?.currency).toBe("EUR");
  });

  it("converts amounts to estimated USD and INR for aggregate summaries", () => {
    const usdFromInr = CurrencyNormalizer.convertToEstimatedUSD(8330, "INR");
    expect(usdFromInr).toBeGreaterThan(90);
    expect(usdFromInr).toBeLessThan(110);

    const inrFromUsd = CurrencyNormalizer.convertToEstimatedINR(10, "USD");
    expect(inrFromUsd).toBe(833.0);
  });

  it("formats localized amounts with currency symbols", () => {
    expect(CurrencyNormalizer.formatAmount(20.5, "USD")).toBe("$20.50");
    expect(CurrencyNormalizer.formatAmount(999, "INR")).toBe("₹999.00");
    expect(CurrencyNormalizer.formatAmount(1500, "JPY")).toBe("¥1,500");
  });
});
