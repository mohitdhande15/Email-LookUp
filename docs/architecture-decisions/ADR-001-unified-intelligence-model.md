# ADR-001: Unified Intelligence Model and Epistemic Honesty Architecture

## Status
Accepted

## Date
2026-11-01

## Context
Email-LookUp originally operated as two loosely coupled tools: an unauthenticated public email lookup and an authenticated Gmail declutter script. Each module parsed disparate external payloads (Gravatar, GitHub, XposedOrNot, Gmail metadata) using ad-hoc object structures and disparate classification rules.

This created multiple architectural risks:
1. **Inconsistent Representation**: Findings in one module could not be correlated with entities discovered in another.
2. **Epistemic Inaccuracy**: Algorithmic guesses and third-party breach mentions were represented to the user as confirmed facts, creating false alarms and potential legal liability.
3. **Graph Incompatibility**: Visualizing digital footprints in a Three.js 3D graph (Phase 5) was impossible without a standardized entity-relationship data model.

## Decision
We decided to introduce a unified, strongly typed intelligence architecture:

1. **Unified Finding Model (`UnifiedFinding`)**:
   - Represents all discoveries through a single polymorphic interface with discriminated unions for `IDENTITY`, `FINANCIAL`, `SECURITY`, and `PRIVACY`.
   - Validated at runtime using comprehensive Zod schemas.

2. **Strict Epistemic Classification**:
   - Every finding, entity, and edge carries a `VerificationStatus` (`CONFIRMED_FACT`, `VERIFIED_USER`, `HIGH_INFERENCE`, `LOW_INFERENCE`, `UNVERIFIED`) and a NATO-standard Source Reliability classification (`A` through `F`).
   - Inferences are never presented as confirmed facts.

3. **Entity-Relationship Graph Foundation**:
   - Entities (`IntelligenceEntity`) and directed edges (`IntelligenceRelationship`) model identities, organizations, subscriptions, and breaches.
   - Built-in projection methods (`projectEntityToGraphNode`, `projectRelationshipToGraphEdge`) output Three.js force-directed graph node and link specifications directly.

4. **Provenance-Tracked Evidence Engine (`EvidenceItem`)**:
   - Every claim is tied to deduplicated evidence records indexed by a SHA-256 fingerprint.
   - Zero raw email body storage is strictly enforced across the schema.

## Consequences
### Positive:
- All four intelligence pillars share identical contracts and can cross-correlate findings.
- The Risk Engine and Recommendation Engine operate over normalized finding objects.
- Graph visualization in Phase 5 is directly enabled without data restructuring.
- Strict epistemic honesty protects user trust and statutory accuracy.

### Negative / Trade-offs:
- Slightly higher memory and processing overhead to construct full entity and evidence graphs.
- External adapters must map third-party responses into the canonical schema before presentation.
