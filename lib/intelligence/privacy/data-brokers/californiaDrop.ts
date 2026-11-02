export interface CaliforniaDropInfo {
  officialUrl: string;
  statutoryAuthority: string;
  governingBody: string;
  description: string;
  eligibility: string;
  mandatoryBrokerCadence: string;
  consumerSteps: string[];
  keyBenefits: string[];
}

export class CaliforniaDropService {
  static getDropMetadata(): CaliforniaDropInfo {
    return {
      officialUrl: "https://privacy.ca.gov/DROP",
      statutoryAuthority: "California Civil Code § 1798.99.86 (SB 362 / The Delete Act, 2023)",
      governingBody: "California Privacy Protection Agency (CPPA)",
      description:
        "The California Delete Request and Opt-Out Platform (DROP) allows consumers to make a single verifiable request to delete their personal information across all registered data brokers operating in California.",
      eligibility:
        "California residents (or authorized agents acting on behalf of California consumers).",
      mandatoryBrokerCadence:
        "Every 45 days, registered data brokers must access DROP, download pending requests, and delete consumer personal information.",
      consumerSteps: [
        "Visit the official state platform at privacy.ca.gov/DROP.",
        "Authenticate using your state-verified identifier or government-backed single sign-on.",
        "Submit a global deletion request encompassing all registered data brokers.",
        "Retain your CPPA confirmation reference code to monitor compliance.",
      ],
      keyBenefits: [
        "Single submission instead of contacting hundreds of individual brokers manually.",
        "Ongoing protection: data brokers must re-verify and delete new records every 45 days.",
        "Statutory enforcement backed by CPPA administrative fines and penalties ($200/day per unfulfilled request).",
      ],
    };
  }

  /**
   * Evaluates if a broker is subject to California DROP mandates.
   */
  static isBrokerDropMandated(registrySources: string[]): boolean {
    return registrySources.includes("CPPA_DROP");
  }
}
