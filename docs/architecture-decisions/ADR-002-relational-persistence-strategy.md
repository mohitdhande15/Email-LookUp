# ADR-002: Relational Persistence Strategy and Multi-Tenant Isolation

## Status
Accepted

## Date
2026-11-01

## Context
Prior to Phase 1, Email-LookUp relied exclusively on volatile in-memory state and browser `localStorage`. When the user refreshed the browser or switched devices, historical declutter discoveries and risk tracking were lost.

Furthermore, evolving into an enterprise-grade cyber-defense platform requires:
1. Multi-tenant security where user data is strictly isolated.
2. Support for Right to Erasure (GDPR Art 17, India DPDP Act 2023 § 12(3)) that guarantees complete, atomic data deletion.
3. Fast relational indexing across findings, entities, and relationships.
4. Seamless developer experience across local testing (in-memory) and production deployments (cloud database).

## Decision
We decided to adopt a **Relational Schema Design using PostgreSQL and Prisma ORM**, abstracted behind the **Repository Pattern**:

1. **Relational Schema (`prisma/schema.prisma`)**:
   - Models: `User`, `Finding`, `Entity`, `Relationship`, `Evidence`, `ScanHistory`, `UserPreference`.
   - Strict composite indexes and constraints: `@@unique([userId, type, canonicalValue])`, `@@unique([userId, fingerprint])`.
   - Complete cascading deletions (`onDelete: Cascade`) linking all tenant records to the parent `User` record.

2. **Repository Interfaces (`lib/intelligence/repositories/types.ts`)**:
   - `IFindingRepository`, `IEntityRepository`, `IRelationshipRepository`, `IEvidenceRepository`.
   - Every interface method requires `userId: string` to enforce tenant isolation at the service boundary.

3. **Pluggable Implementations**:
   - Production: `PrismaFindingRepository` targeting PostgreSQL.
   - Development & Unit Testing: `InMemoryFindingRepository` providing fully isolated in-memory collections with zero external database dependencies.

4. **Zero Raw Mailbox Storage Policy**:
   - The database schema intentionally omits message body fields, storing only subject lines, timestamps, sender domains, and cryptographic fingerprints.

## Consequences
### Positive:
- Total multi-tenant isolation prevents cross-tenant data leakage.
- Clean separation of business logic from database technology allows testing with 100% in-memory repositories.
- One-click account deletion triggers immediate atomic database purge meeting statutory compliance standards.
- Production PostgreSQL indexing provides fast queries for large identity graphs.

### Negative / Trade-offs:
- Requires PostgreSQL database provisioning in production environments.
- Prisma schema migrations must be managed alongside application deployments.
