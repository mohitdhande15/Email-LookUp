import { type UnifiedFinding, type FindingCategory } from "../core/finding";
import { type IntelligenceEntity, type EntityType } from "../core/entity";
import { type IntelligenceRelationship } from "../core/relationship";
import { type EvidenceItem } from "../core/evidence";

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface IFindingRepository {
  save(finding: UnifiedFinding): Promise<void>;
  saveBatch(findings: UnifiedFinding[]): Promise<void>;
  findById(userId: string, id: string): Promise<UnifiedFinding | null>;
  findByCategory(
    userId: string,
    category: FindingCategory,
    options?: PaginationOptions
  ): Promise<UnifiedFinding[]>;
  listByUser(userId: string, options?: PaginationOptions): Promise<UnifiedFinding[]>;
  delete(userId: string, id: string): Promise<boolean>;
  countByUser(userId: string): Promise<number>;
}

export interface IEntityRepository {
  save(entity: IntelligenceEntity): Promise<void>;
  saveBatch(entities: IntelligenceEntity[]): Promise<void>;
  findById(userId: string, id: string): Promise<IntelligenceEntity | null>;
  findByPrimaryValue(
    userId: string,
    type: EntityType,
    primaryValue: string
  ): Promise<IntelligenceEntity | null>;
  listByUser(userId: string, options?: PaginationOptions): Promise<IntelligenceEntity[]>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface IRelationshipRepository {
  save(relationship: IntelligenceRelationship): Promise<void>;
  saveBatch(relationships: IntelligenceRelationship[]): Promise<void>;
  findById(userId: string, id: string): Promise<IntelligenceRelationship | null>;
  listByUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<IntelligenceRelationship[]>;
  findByEntity(userId: string, entityId: string): Promise<IntelligenceRelationship[]>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface IEvidenceRepository {
  save(evidence: EvidenceItem): Promise<void>;
  saveBatch(evidenceList: EvidenceItem[]): Promise<void>;
  findById(userId: string, id: string): Promise<EvidenceItem | null>;
  findByFingerprint(userId: string, fingerprint: string): Promise<EvidenceItem | null>;
  findByFindingId(userId: string, findingId: string): Promise<EvidenceItem[]>;
  delete(userId: string, id: string): Promise<boolean>;
}
