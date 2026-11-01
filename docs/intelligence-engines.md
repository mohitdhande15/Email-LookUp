# Intelligence Engines & Risk Modeling — System Specification

## 1. Modular Intelligence Architecture

The intelligence layer is divided into specialized engines coordinated through common domain contracts in `lib/intelligence/`:

```
lib/intelligence/
├── core/                    # Unified findings, entities, relationships, evidence, Zod schemas
├── identity/                # Identity Engine & Public Discovery integration
├── financial/               # Financial Intelligence Engine foundation
├── security/                # Security Intelligence & Breach Engine foundation
├── privacy/                 # Privacy Management & Erasure Engine foundation
├── risk/                    # Explainable Risk Engine & What-If Simulator
├── recommendations/         # Recommendation Engine & Action Planner
├── repositories/            # Repository pattern (In-Memory + Prisma)
└── cache/                   # Scoped cache & sliding-window rate limiters
```

---

## 2. The Four Functional Pillars

### 2.1 Identity Engine (`lib/intelligence/identity/`)
- **Mission**: Discovers, aggregates, and correlates public persona indicators across GitHub, Gravatar, and public identity registries.
- **Current Adapter (`identityEngine.ts`)**:
  - Ingests raw public lookup data (`Gravatar`, `GitHub`, `Breaches`).
  - Converts public records into strongly typed `UnifiedFinding` records under the `IDENTITY` and `SECURITY` categories.
  - Constructs `IntelligenceEntity` nodes (for the primary email, GitHub user, Gravatar profile, and compromised organizations).
  - Establishes `IntelligenceRelationship` edges (`ASSOCIATED_WITH`, `DISCOVERED_ON`, `EXPOSED_IN`) linking identities to their evidence.
  - Generates verifiable `EvidenceItem` records with SHA-256 fingerprints.

### 2.2 Financial Intelligence Engine (`lib/intelligence/financial/`)
- **Mission**: Discovers recurring financial commitments, subscription renewals, SaaS spend, and trial periods without accessing raw message bodies.
- **Contract (`financialEngine.ts`)**:
  - `SubscriptionPlan`: Vendor, renewal cadence, estimated cost, currency, cancellation URI.
  - Zero-storage extraction: Operates exclusively on header metadata and sanitized transaction subjects.
  - Produces `FINANCIAL` findings with `FinancialFindingPayload`.

### 2.3 Security Intelligence Engine (`lib/intelligence/security/`)
- **Mission**: Continuously audits breach exposure, credential leaks, and OAuth application permissions.
- **Contract (`securityEngine.ts`)**:
  - Correlates multi-source breaches (HaveIBeenPwned, XposedOrNot).
  - Assesses credential severity (plaintext passwords vs. hashed credentials).
  - Identifies dormant OAuth tokens requiring revocation.
  - Produces `SECURITY` findings with `SecurityFindingPayload`.

### 2.4 Privacy Management Engine (`lib/intelligence/privacy/`)
- **Mission**: Maps data broker listings, tracks unsolicited newsletters, and automates privacy erasure rights.
- **Contract (`privacyEngine.ts`)**:
  - Identifies broker aggregators and opt-out endpoints.
  - Formulates statutory notices conforming to GDPR Art 17, CCPA § 1798, and India DPDP 2023 § 12(3).
  - Produces `PRIVACY` findings with `PrivacyFindingPayload`.

---

## 3. Explainable Risk Engine (`lib/intelligence/risk/riskEngine.ts`)

### 3.1 Scoring Methodology
The platform computes a normalized risk score between **0 and 100**, where 0 indicates minimum detected exposure and 100 indicates catastrophic vulnerability.

Rather than relying on opaque heuristics, every point of the risk score is transparently explained through a **Factor Breakdown**:

$$\text{Total Score} = \min\left(100, \sum_{i} \text{Factor Weight}_i\right)$$

### 3.2 Weighting Matrix
| Factor Key | Factor Description | Maximum Points | Calculation Rule |
| :--- | :--- | :--- | :--- |
| `breach_passwords` | Leaked Plaintext / Hash Passwords | 35 pts | 15 pts per breach exposing passwords |
| `breach_pii` | Compromised Personal Data (Names, DOB, Phone) | 20 pts | 5 pts per breach exposing PII |
| `unverified_breach` | Unacknowledged / Unremediated Breaches | 15 pts | 5 pts per unverified breach finding |
| `financial_exposure`| High Recurring Unmanaged Subscriptions | 15 pts | 5 pts per unmanaged subscription > $20/mo |
| `oauth_dormant` | Excessive or Dormant Third-Party OAuth Grants | 10 pts | 5 pts per broad-scope OAuth permission |
| `privacy_exposure` | Data Broker Listings / Public Tracking | 15 pts | 5 pts per discovered broker profile |

### 3.3 Score Classification
- **0 – 24**: `MINIMAL` (Clean digital posture, minimal exposures detected)
- **25 – 49**: `LOW` (Minor newsletter tracking or old non-sensitive breaches)
- **50 – 74**: `MEDIUM` (Multiple unverified breaches or active financial leaks)
- **75 – 89**: `HIGH` (Direct password exposures requiring credential resets)
- **90 – 100**: `CRITICAL` (Active credential leaks across multiple critical platforms)

---

## 4. What-If Simulation Engine

The Risk Engine features a deterministic **What-If Simulation** capability (`simulateRiskImpact`):
- Accepts a set of proposed remediation actions (e.g., "Change password on Adobe", "Revoke OAuth access for App X", "Send erasure notice to Data Broker Y").
- Simulates the removal or mitigation of associated risk factors.
- Calculates:
  - Simulated new score
  - Exact score delta ($\Delta$)
  - Percentage risk reduction
  - Re-ranked factor breakdown

This enables the frontend to show users real-time feedback: *"Taking these 3 actions will reduce your risk score from 78 to 32 (-59%)."*

---

## 5. Recommendation Engine (`lib/intelligence/recommendations/recommendationEngine.ts`)

- **Prioritization**: Ranks actions by calculated risk impact divided by estimated execution effort:
  $$\text{Priority Rank} = \frac{\Delta \text{Risk Impact}}{\text{Effort Weight}}$$
- **Deduplication**: Merges duplicate actions across findings sharing the same target domain or vendor.
- **Action Plan**: Formulates an executable action sequence categorizing steps into:
  - Immediate (password rotations, OAuth revocations)
  - Short-Term (subscription cancellations)
  - Long-Term (statutory privacy opt-outs)
