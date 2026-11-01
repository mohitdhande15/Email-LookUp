# Data Model — Unified Intelligence & Entity-Relationship Schema

## 1. Overview

The unified data model provides a standardized representation for all discoveries, entities, relationships, and supporting evidence across all intelligence engines.

All types are defined in `lib/intelligence/core/` and validated at runtime using Zod schemas (`lib/intelligence/core/schemas.ts`).

---

## 2. Epistemic Confidence & Verification Status

To uphold epistemic honesty, the system never presents inferred data as confirmed fact. Every finding, entity, and relationship carries explicit confidence classifications:

### Verification Status (`VerificationStatus`)
- `CONFIRMED_FACT`: Directly verified from authoritative, primary sources (e.g. valid cryptographic signature, authenticated OAuth profile).
- `VERIFIED_USER`: Explicitly acknowledged, verified, or confirmed by the authenticated end-user.
- `HIGH_INFERENCE`: Derived from strong deterministic heuristics (e.g. exact domain and subject match across multiple recurring transactions).
- `LOW_INFERENCE`: Weak association (e.g. single marketing email from third party).
- `UNVERIFIED`: Raw third-party claim not yet independently validated.

### Source Reliability (`SourceReliability`)
- `A_COMPLETELY_RELIABLE`: Authenticated primary sources (e.g., Google OAuth API).
- `B_USUALLY_RELIABLE`: Established public data registries (e.g., GitHub, Gravatar, HaveIBeenPwned).
- `C_FAIRLY_RELIABLE`: Aggregated breach dumps and commercial registries.
- `D_NOT_USUALLY_RELIABLE`: Uncorroborated third-party mentions.
- `E_UNRELIABLE`: Known fraudulent or adversarial signals.
- `F_CANNOT_BE_JUDGED`: Reliability unable to be assessed.

---

## 3. Unified Finding Model (`UnifiedFinding`)

A `UnifiedFinding` represents an actionable intelligence observation:

```typescript
export interface UnifiedFinding<T = FindingPayload> {
  id: string;                      // Unique identifier (UUIDv4)
  userId: string;                  // Tenant identifier (user-scoped or "public")
  category: FindingCategory;       // "IDENTITY" | "FINANCIAL" | "SECURITY" | "PRIVACY"
  subcategory: string;             // Engine-specific subcategory
  title: string;                   // Concise summary of finding
  description: string;             // Contextual narrative explanation
  source: string;                  // Ingesting engine / external source
  sourceReference?: string;        // External reference ID / URL
  observedAt: string;              // ISO 8601 observation timestamp
  eventAt?: string;                // ISO 8601 incident/occurrence timestamp
  confidence: number;              // Epistemic score (0.0 to 1.0)
  severity: FindingSeverity;       // "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  verificationStatus: VerificationStatus;
  evidenceIds: string[];           // Foreign keys to supporting EvidenceItem records
  relatedEntityIds: string[];      // Foreign keys to associated IntelligenceEntity records
  recommendedActions: FindingAction[]; // Prescribed remediation actions
  metadata: Record<string, unknown>;
  payload?: T;                     // Discriminated category payload
}
```

### Discriminated Payloads
- **`IdentityFindingPayload`**: Handles public profiles, cryptographic keys, handle associations, exposed emails.
- **`FinancialFindingPayload`**: Handles recurring subscriptions, billing intervals, renewal dates, estimated amounts, currencies, cancellation URLs.
- **`SecurityFindingPayload`**: Handles breach incidents, exposed data classes (passwords, phone numbers), breach names, password reset requirements, breach dates.
- **`PrivacyFindingPayload`**: Handles data broker profiles, opt-out mechanisms, newsletter subscriptions, tracking pixels, statutory erasure eligibility.

---

## 4. Entity and Relationship Graph Model

The Entity-Relationship graph powers both identity tracking and the future Three.js Digital Identity Graph (Phase 5).

### Intelligence Entity (`IntelligenceEntity`)
Represents an identifiable node in the user's digital footprint:
- **Types**: `EMAIL_IDENTITY`, `PUBLIC_PROFILE`, `ORGANIZATION`, `DOMAIN`, `ONLINE_PLATFORM`, `SUBSCRIPTION`, `SECURITY_EVENT`, `DATA_BREACH`, `OAUTH_APPLICATION`, `CRYPTOGRAPHIC_IDENTITY`.
- **Graph Projection (`projectEntityToGraphNode`)**: Projects an entity into a Three.js compatible node:
  ```typescript
  {
    id: string;
    label: string;
    type: EntityType;
    category: string;
    riskScore: number;
    val: number;          // Node size proportional to risk and connections
    color: string;        // Color mapped to category
    status: VerificationStatus;
    properties: Record<string, unknown>;
  }
  ```

### Intelligence Relationship (`IntelligenceRelationship`)
Represents a directed epistemic edge connecting two entities:
- **Types**: `ASSOCIATED_WITH`, `DISCOVERED_ON`, `EXPOSED_IN`, `SUBSCRIBED_TO`, `AUTHENTICATED_WITH`, `RECEIVED_FROM`, `RELATED_TO`.
- **Properties**: `sourceEntityId`, `targetEntityId`, `confidence`, `evidenceIds`, `verificationStatus`.
- **Graph Projection (`projectRelationshipToGraphEdge`)**: Projects a relationship into a Three.js compatible edge:
  ```typescript
  {
    source: string;
    target: string;
    type: RelationshipType;
    label: string;
    confidence: number;
    color: string;
    width: number;
  }
  ```

---

## 5. Evidence Engine (`EvidenceItem`)

Every claim or finding must be backed by concrete, provenance-tracked evidence.

```typescript
export interface EvidenceItem {
  id: string;                      // SHA-256 fingerprint or UUID
  findingId?: string;              // Associated finding
  sourceIdentifier: string;        // Data source identifier
  evidenceType: EvidenceType;      // "API_RESPONSE" | "HEADER_METADATA" | "TRANSACTION_RECORD" | ...
  observedAt: string;              // ISO 8601 observation date
  reliability: SourceReliability;  // NATO-style A-F rating
  fingerprint: string;             // SHA-256 hash of canonical evidence
  redactedSnippet?: string;        // Safe text snippet (all sensitive tokens redacted)
  metadata: Record<string, unknown>;
}
```

### Zero Raw Mailbox Body Rule
Raw Gmail or email message bodies are strictly prohibited from being placed in `metadata` or `redactedSnippet`. Only cryptographic hashes, header metadata, subject lines, dates, and domain names are preserved.
