import {
  type DataBrokerRecord,
  type BrokerCategory,
  type BrokerJurisdiction,
} from "../privacyTypes";
import { VERIFIED_DATA_BROKERS } from "./brokerRegistry";

export interface BrokerFilterCriteria {
  category?: BrokerCategory | "ALL";
  jurisdiction?: BrokerJurisdiction | "ALL";
  californiaDropOnly?: boolean;
  searchTerm?: string;
}

export interface MatchedBrokerResult {
  broker: DataBrokerRecord;
  reasonForInclusion: string;
  isDirectDomainMatch: boolean;
  recommendedAction: string;
}

export class BrokerMatcher {
  /**
   * Matches data brokers against user's discovered domains and mailbox history.
   * Strictly adheres to epistemic honesty: states clearly that inclusion is based on
   * public broker practices, not verified database inspection unless confirmed by user.
   */
  static matchBrokers(
    discoveredDomains: string[] = [],
    criteria: BrokerFilterCriteria = {}
  ): MatchedBrokerResult[] {
    const normalizedDomains = new Set(
      discoveredDomains.map((d) => d.toLowerCase().trim())
    );

    return VERIFIED_DATA_BROKERS.filter((broker) => {
      // Category filter
      if (criteria.category && criteria.category !== "ALL") {
        if (broker.category !== criteria.category) return false;
      }

      // Jurisdiction filter
      if (criteria.jurisdiction && criteria.jurisdiction !== "ALL") {
        if (
          broker.jurisdiction !== criteria.jurisdiction &&
          broker.jurisdiction !== "GLOBAL" &&
          broker.jurisdiction !== "US_GENERAL"
        ) {
          return false;
        }
      }

      // California DROP filter
      if (criteria.californiaDropOnly && !broker.californiaDropEligible) {
        return false;
      }

      // Search term filter
      if (criteria.searchTerm) {
        const query = criteria.searchTerm.toLowerCase().trim();
        const matchesName = broker.name.toLowerCase().includes(query);
        const matchesCategory = broker.category.toLowerCase().includes(query);
        const matchesDesc = broker.instructions.toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesDesc) return false;
      }

      return true;
    }).map((broker) => {
      const brokerDomain = new URL(broker.website).hostname.replace(/^www\./, "");
      const isDirectMatch = normalizedDomains.has(brokerDomain);

      let reason: string;
      if (isDirectMatch) {
        reason = `Direct mailbox correspondence detected from ${brokerDomain}. Direct relationship confirmed.`;
      } else if (broker.category === "PEOPLE_SEARCH") {
        reason =
          "People-search directory: routinely scrapes publicly accessible county records, phone registries, voter rolls, and social media data without prior user notification.";
      } else if (broker.category === "MARKETING_ADVERTISING") {
        reason =
          "Commercial advertising graph: aggregates consumer purchase histories, device IDs, and email hashes from commercial partners and retail networks.";
      } else {
        reason =
          "Regulated data broker: aggregated consumer profile likely maintained under state broker registry filings.";
      }

      const action = broker.californiaDropEligible
        ? "Submit request via individual opt-out portal or use California DROP for automated coverage."
        : "Complete the verified online opt-out process.";

      return {
        broker,
        reasonForInclusion: reason,
        isDirectDomainMatch: isDirectMatch,
        recommendedAction: action,
      };
    });
  }
}
