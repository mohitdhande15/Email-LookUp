# Privacy Management, Footprint Control & Automated Cleanup Architecture

## Overview

**Phase 4: Privacy Management & Footprint Defense** transforms Email-LookUp into an end-to-end Personal Digital Identity & Cyber-Defense Platform. It equips users with capabilities to discover, understand, monitor, and actively reduce their exposed digital footprint.

The privacy subsystem is fully integrated with the **Unified Intelligence Architecture** (producing `UnifiedFinding` records under category `PRIVACY`, `IntelligenceEntity` graph nodes, `IntelligenceRelationship` edges, and SHA-256 fingerprinted `EvidenceItem` records).

---

## Core Privacy Modules

### 1. Module A: One-Click Unsubscribe Engine (`lib/intelligence/privacy/unsubscribe/`)
- **RFC 8058 & RFC 2369 Compliance**: Parses `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- **SSRF Defense (`unsubscribeSecurity.ts`)**:
  - Enforces HTTPS-only protocol.
  - Prohibits IPv4 loopback (`127.0.0.0/8`), RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and Link-Local / Cloud Metadata (`169.254.0.0/16` / `169.254.169.254`).
  - Prohibits IPv6 loopback (`::1`), Unique Local (`fc00::/7`), and Link-Local (`fe80::/10`).
  - Prohibits internal hostnames (`localhost`, `*.internal`, `*.local`).
  - Pre-flight DNS resolution to defeat DNS rebinding.
  - Follows up to 3 redirect hops, re-validating SSRF policy at each hop.
  - Strips ambient cookies and authorization tokens.
- **Fail-Closed Confirmation (`unsubscribeExecutor.ts`)**: Outbound unsubscription requires explicit user confirmation.

### 2. Module B: OAuth Permission Center (`lib/intelligence/privacy/oauth/`)
- **Multi-Provider Registry (`oauthProviderRegistry.ts`)**: Google, GitHub, Discord, Microsoft, Apple.
- **Scope Dictionary (`KNOWN_SCOPES`)**: Human-readable descriptions and four-tier risk classification (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- **Direct Management Links**: Deep links to verified third-party security management portals (`myaccount.google.com/connections`, `github.com/settings/applications`, `discord.com/settings/authorized-apps`).

### 3. Module C: Data Broker Intelligence (`lib/intelligence/privacy/data-brokers/`)
- **Official Registry Cross-Reference**: Curated list of data brokers verified against state registry filings (California Privacy Protection Agency CPPA, Vermont Secretary of State).
- **California DROP Integration (`californiaDrop.ts`)**: Information and guidance on the Delete Request and Opt-Out Platform (SB 362 / Delete Act, 2023) administered by CPPA (`privacy.ca.gov/DROP`).
- **Strict Epistemic Honesty (`brokerMatcher.ts`)**: Clear differentiation between direct domain communication and probabilistic industry aggregation practices.

### 4. Module D: Legal Erasure Request Tracker (`lib/intelligence/privacy/legal/`)
- **Statutory Accurate Frameworks**:
  - **GDPR Art 17 / 12(3)**: 30-day initial deadline + 60-day extension for complex requests.
  - **CCPA § 1798.105 / 130**: 45-day initial deadline + 45-day extension.
  - **India DPDP Act 2023**: Accurately reflects MeitY Notification S.O. 4930(E) dated Nov 13, 2025, establishing Section 12 commencement on **May 13, 2027**. Notices dispatched prior to May 13, 2027 are classified as voluntary/informational privacy demands.
- **Deadline Calculator (`legalDeadlineCalculator.ts`)**: Computes initial and extension deadlines, days remaining, and urgency tiers (`CRITICAL`, `HIGH`, `NORMAL`, `EXPIRED`, `COMPLETED`).
- **Template Generator (`legalTemplateGenerator.ts`)**: Generates formal erasure demands with statutory citations and disclaimers.

### 5. Module E: Account Cleanup State Machine (`lib/intelligence/privacy/cleanup/`)
- **Formal State Machine (`cleanupStateMachine.ts`)**:
  `DISCOVERED` → `UNDER_REVIEW` → `KEEP_ACCOUNT` | `CLEANUP_PLANNED` → `UNSUBSCRIBE_PENDING` → `UNSUBSCRIBED` → `DELETION_REQUESTED` → `RESPONSE_RECEIVED` → `DELETION_CONFIRMED`.
- **Deletion Difficulty Ratings (`deletionDifficulty.ts`)**: Rates platforms as `EASY`, `MODERATE`, `DIFFICULT`, or `UNKNOWN` based on verified documentation in `lib/deleteLinks.ts`.

### 6. Module F: Email Privacy Inspector (`lib/intelligence/privacy/email-privacy/`)
- **Zero-Remote-Fetch Inspection**: Detects 1x1 tracking pixels, hidden zero-size beacons, and telemetry click-redirect links completely in memory without making outbound HTTP requests or loading images.
- **Zero-Body Retention**: Raw message bodies and snippets are evaluated transiently and immediately discarded.

---

## User Interface

The `/privacy` page hosts the `PrivacyDashboard.tsx` component, featuring 7 dedicated tabs:
1. **Overview**: Privacy Health Score gauge, summary metrics, California DROP callout, quick action lists.
2. **Unsubscribe Radar**: RFC 8058 One-Click POST actions, Mailto triggers, frequency analytics.
3. **OAuth Center**: Connected third-party apps, scope analysis, provider console links.
4. **Data Brokers**: Searchable directory, category and jurisdiction filters, California DROP eligibility indicators.
5. **Legal Erasure**: Active request tracker, deadline countdowns, interactive legal template generator modal.
6. **Account Cleanup**: Interactive lifecycle table, transition action controls, direct deletion URLs.
7. **Email Telemetry**: Discovered tracking beacons, marketing automation providers, and click-wrapping domains.
