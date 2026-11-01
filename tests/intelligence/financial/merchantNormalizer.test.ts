import { describe, it, expect } from "vitest";
import { MerchantNormalizer } from "@/lib/intelligence/financial/merchantNormalizer";

describe("MerchantNormalizer", () => {
  it("normalizes known SaaS and developer platforms", () => {
    const openai = MerchantNormalizer.normalize("billing@openai.com", "OpenAI Invoicing");
    expect(openai.canonicalName).toBe("OpenAI");
    expect(openai.category).toBe("SAAS");
    expect(openai.isKnownSubscriptionMerchant).toBe(true);

    const github = MerchantNormalizer.normalize("notifications@github.com", "GitHub");
    expect(github.canonicalName).toBe("GitHub");
    expect(github.category).toBe("SAAS");

    const vercel = MerchantNormalizer.normalize("billing@vercel.com", "Vercel Invoices");
    expect(vercel.canonicalName).toBe("Vercel");
    expect(vercel.category).toBe("SAAS");
  });

  it("normalizes streaming and media platforms", () => {
    const netflix = MerchantNormalizer.normalize("info@mailer.netflix.com", "Netflix");
    expect(netflix.canonicalName).toBe("Netflix");
    expect(netflix.category).toBe("STREAMING");
    expect(netflix.defaultCancellationUrl).toContain("netflix.com");

    const spotify = MerchantNormalizer.normalize("no-reply@spotify.com", "Spotify");
    expect(spotify.canonicalName).toBe("Spotify");
    expect(spotify.category).toBe("STREAMING");
  });

  it("strictly separates AWS from Amazon retail services", () => {
    const aws = MerchantNormalizer.normalize("aws-receivables-support@amazon.com", "AWS Billing");
    expect(aws.canonicalName).toBe("Amazon Web Services");
    expect(aws.category).toBe("SAAS");
    expect(aws.canonicalDomain).toBe("aws.amazon.com");

    const prime = MerchantNormalizer.normalize("auto-confirm@amazon.in", "Amazon Prime");
    expect(prime.canonicalName).toBe("Amazon Prime");
    expect(prime.category).toBe("MEMBERSHIP");
  });

  it("disambiguates generic relay domains using display name", () => {
    const store = MerchantNormalizer.normalize("mailer@shopify.com", "Acme Artisan Coffee");
    expect(store.canonicalName).toBe("Acme Artisan Coffee");
    expect(store.canonicalDomain).toBe("shopify.com");
    expect(store.isKnownSubscriptionMerchant).toBe(false);
  });

  it("falls back to capitalizing clean domain name", () => {
    const custom = MerchantNormalizer.normalize("support@customtool.io");
    expect(custom.canonicalName).toBe("Customtool");
    expect(custom.canonicalDomain).toBe("customtool.io");
  });
});
