import { describe, it, expect } from "vitest";
import { VERIFIED_DATA_BROKERS } from "@/lib/intelligence/privacy/data-brokers/brokerRegistry";
import { CaliforniaDropService } from "@/lib/intelligence/privacy/data-brokers/californiaDrop";
import { BrokerMatcher } from "@/lib/intelligence/privacy/data-brokers/brokerMatcher";

describe("Data Broker Intelligence & California DROP Registry", () => {
  it("contains curated registry verified against state registries with direct opt-out URLs", () => {
    expect(VERIFIED_DATA_BROKERS.length).toBeGreaterThanOrEqual(10);

    const acxiom = VERIFIED_DATA_BROKERS.find((b) => b.id === "broker_acxiom");
    expect(acxiom).toBeDefined();
    expect(acxiom?.optOutUrl).toContain("https://");
    expect(acxiom?.registrySources).toContain("CPPA_DROP");
    expect(acxiom?.californiaDropEligible).toBe(true);

    const spokeo = VERIFIED_DATA_BROKERS.find((b) => b.id === "broker_spokeo");
    expect(spokeo?.category).toBe("PEOPLE_SEARCH");
    expect(spokeo?.deletionDifficulty).toBe("EASY");
  });

  it("verifies California DROP statutory parameters and official portal", () => {
    const dropInfo = CaliforniaDropService.getDropMetadata();
    expect(dropInfo.officialUrl).toBe("https://privacy.ca.gov/DROP");
    expect(dropInfo.statutoryAuthority).toContain("SB 362");
    expect(dropInfo.mandatoryBrokerCadence).toContain("45 days");
  });

  it("matches brokers with strict epistemic honesty distinguishing public inference from fact", () => {
    const results = BrokerMatcher.matchBrokers(["netflix.com", "spokeo.com"]);

    // Spokeo is a direct domain match
    const spokeoMatch = results.find((r) => r.broker.id === "broker_spokeo");
    expect(spokeoMatch?.isDirectDomainMatch).toBe(true);
    expect(spokeoMatch?.reasonForInclusion).toContain("Direct relationship confirmed");

    // Other brokers are inferred
    const whitepagesMatch = results.find((r) => r.broker.id === "broker_whitepages");
    expect(whitepagesMatch?.isDirectDomainMatch).toBe(false);
    expect(whitepagesMatch?.reasonForInclusion).toContain("scrapes publicly accessible county records");
  });

  it("filters brokers by category and California DROP mandate", () => {
    const peopleSearchOnly = BrokerMatcher.matchBrokers([], {
      category: "PEOPLE_SEARCH",
    });
    expect(peopleSearchOnly.every((r) => r.broker.category === "PEOPLE_SEARCH")).toBe(true);

    const dropOnly = BrokerMatcher.matchBrokers([], {
      californiaDropOnly: true,
    });
    expect(dropOnly.every((r) => r.broker.californiaDropEligible)).toBe(true);
  });
});
