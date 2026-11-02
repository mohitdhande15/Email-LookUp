# Data Broker Intelligence & California DROP Integration

## Overview

Data brokers collect, aggregate, and commercialize consumer data without having a direct relationship with the consumer. To assist users in identifying and removing their exposed records, Email-LookUp provides an authoritative **Data Broker Registry** cross-referenced against official state data broker registries.

---

## State Data Broker Registries

### 1. California Privacy Protection Agency (CPPA) Registry
- Established pursuant to the California Consumer Privacy Act and the Data Broker Registration statute (Cal. Civ. Code § 1798.99.80 et seq.).
- Mandates annual registration for all covered data brokers operating in California.

### 2. Vermont Secretary of State Registry
- Enacted under 9 V.S.A. § 2446.
- Requires data brokers to register annually and disclose opt-out mechanisms, credential practices, and public record sources.

---

## California Delete Request and Opt-Out Platform (DROP)

### Statutory Background
Senate Bill 362 (The California Delete Act of 2023, Cal. Civ. Code § 1798.99.86) directs the California Privacy Protection Agency (CPPA) to establish an accessible, single-stop deletion mechanism called **DROP**.

### Key Provisions
1. **Single Submission Portal**: Consumers access `https://privacy.ca.gov/DROP` to submit a verifiable request.
2. **Mandatory 45-Day Cadence**: Beginning after DROP implementation, every registered data broker in California is legally obligated to access DROP every 45 days, retrieve pending consumer requests, and permanently delete all personal information relating to that consumer.
3. **Continuous Purge Obligation**: Once a request is processed, the broker must also delete any newly acquired personal data regarding that consumer every 45 days thereafter.
4. **Enforcement & Penalties**: Non-compliant brokers face administrative fines of \$200 per day per unfulfilled consumer deletion request.

---

## Epistemic Honesty & Inference Standards

Email-LookUp operates under strict epistemic integrity:
- **Direct Domain Matches**: If the user has direct correspondence with a data broker (e.g., received an email from `spokeo.com`), the relationship is marked `CONFIRMED_FACT` with `AUTHORITATIVE` reliability.
- **Probabilistic Matches**: For people-search directories (Whitepages, Radaris, BeenVerified), profiles are created by automated scraping of public court records, voter registrations, and phone listings. The platform explicitly presents these as `HIGH_INFERENCE` or `POTENTIAL_EXPOSURE` and never claims that an unverified user record is guaranteed to exist without confirmation.
- **Opt-Out Verification**: Opt-out statuses (`NOT_STARTED`, `IN_PROGRESS`, `OPTED_OUT`, `CONFIRMED`) track user progress without falsely asserting third-party compliance.
