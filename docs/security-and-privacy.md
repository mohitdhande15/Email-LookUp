# Security and Privacy Architecture

## 1. Epistemic Honesty Principles

In digital identity and cybersecurity tooling, misrepresenting an algorithmic inference as an established fact destroys user trust and creates legal liability.

Email-LookUp operates under strict **Epistemic Honesty Principles**:
1. **Never conflate inference with fact**: If an identity correlation is established through heuristic matching (e.g. username similarity or newsletter receipt), it is strictly tagged as `HIGH_INFERENCE` or `LOW_INFERENCE`.
2. **Require explicit verification for confirmed status**: Only primary cryptographic proofs or direct OAuth provider assertions receive `CONFIRMED_FACT`. Only manual user acknowledgment receives `VERIFIED_USER`.
3. **Explicit Confidence Scoring**: All findings provide a numerical confidence score ($0.0 \le c \le 1.0$) coupled with a NATO-standard Source Reliability classification (`A` through `F`).

---

## 2. Zero Raw Mailbox Body Architecture

The platform provides mailbox declutter and subscription intelligence without ever persisting raw email bodies:
- **Header-Only Ingestion**: The Gmail API integration requests only minimal metadata fields (`id`, `threadId`, `labelIds`, and specific headers: `From`, `Subject`, `Date`, `List-Unsubscribe`).
- **In-Memory Parsing**: Extraction of subscription domains and newsletter signals occurs in volatile execution memory.
- **Zero Disk Persistence**: Raw message content is never logged, never cached in Redis, and never written to PostgreSQL.
- **Deduplicated Cryptographic Evidence**: Evidence items store only a SHA-256 fingerprint generated from canonical metadata:
  $$\text{Fingerprint} = \text{SHA-256}(\text{source} \parallel \text{type} \parallel \text{canonicalKey})$$

---

## 3. Cache & Rate-Limit Security Partitioning

Shared caching layers frequently introduce cross-tenant information disclosure vulnerabilities if cache keys lack strict security boundaries.

### 3.1 Strict Key Scoping (`lib/intelligence/cache/`)
All cache keys are generated through `buildScopedCacheKey`:
- **Authenticated Queries**: `sec:user:<userId>:<namespace>:<hash>`
- **Public Lookups**: `sec:public:<namespace>:<hash>`

This guarantees that:
- A public query can never access or poison a private authenticated user's cached findings.
- Tenant A can never retrieve cached metadata belonging to Tenant B.

### 3.2 Partitioned Rate Limiting
- **Public Endpoints (`/api/search`)**: Enforces IP-based rate limiting (10 requests per 60 seconds) with sliding window accounting to prevent API scraping and denial of service against third-party endpoints.
- **Authenticated Endpoints (`/api/declutter`)**: Enforces user-session rate limiting with dedicated quotas to prevent Google API quota exhaustion.

---

## 4. CSV Formula Injection Neutralization (CWE-1236)

When exporting findings or accounts to CSV, untrusted third-party inputs (such as sender display names, newsletter subjects, or breach descriptions) could begin with malicious spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`).

`lib/csvSanitizer.ts` strictly sanitizes every cell prior to CSV assembly:
1. Strips leading and trailing whitespace.
2. If the first character matches `^[=+\-@\t\r]`, prepends a single quote (`'`), forcing spreadsheet software (Excel, LibreOffice, Google Sheets) to treat the cell as literal text rather than executable bytecode.
3. Wraps fields containing commas, quotes, or newlines in standard RFC 4180 quotes with escaped double-quotes (`""`).

---

## 5. Token Lifecycle & Authentication Security

- **Google OAuth Token Refresh**: Implemented in `auth.ts` via `lib/oauthRefresh.ts`. Refresh tokens are preserved across token rotations and automatically refreshed before expiry without interrupting user scans.
- **Fail-Closed Runtime Secrets**: `lib/config.ts` validates `AUTH_SECRET` at server boot. In production environments (`NODE_ENV === "production"`), missing secrets throw a fatal exception, preventing the server from starting with insecure defaults.

---

## 6. Statutory Compliance & Erasure Notices

The platform's legal notice generation engine (`lib/legalErasure.ts`) incorporates verified statutory legal references:

- **GDPR (European Union)**: Article 17 ("Right to Erasure / Right to be Forgotten"). Requires erasure without undue delay (maximum 30 days).
- **CCPA / CPRA (California, US)**: California Civil Code § 1798.105 (Consumer request to delete personal information). Mandates 45-day response timeline.
- **DPDP Act 2023 (India)**:
  - Digital Personal Data Protection Act, 2023.
  - Section 1(2) sets out commencement provisions.
  - Section 12(3) codifies the Data Principal's statutory right to correction and erasure of personal data.
