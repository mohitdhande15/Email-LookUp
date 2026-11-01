import {
  type IFindingRepository,
  type IEntityRepository,
  type IRelationshipRepository,
  type IEvidenceRepository,
  type PaginationOptions,
} from "./types";
import { type UnifiedFinding, type FindingCategory } from "../core/finding";
import { type IntelligenceEntity, type EntityType } from "../core/entity";
import { type IntelligenceRelationship } from "../core/relationship";
import { type EvidenceItem } from "../core/evidence";
import {
  UnifiedFindingSchema,
  IntelligenceEntitySchema,
  IntelligenceRelationshipSchema,
  EvidenceItemSchema,
} from "../core/schemas";

function applyPagination<T>(items: T[], options?: PaginationOptions): T[] {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? items.length;
  return items.slice(offset, offset + limit);
}

export class InMemoryFindingRepository implements IFindingRepository {
  // Keyed by `userId:findingId`
  private store = new Map<string, UnifiedFinding>();

  async save(finding: UnifiedFinding): Promise<void> {
    UnifiedFindingSchema.parse(finding);
    const key = `${finding.userId}:${finding.id}`;
    this.store.set(key, JSON.parse(JSON.stringify(finding)));
  }

  async saveBatch(findings: UnifiedFinding[]): Promise<void> {
    for (const f of findings) {
      await this.save(f);
    }
  }

  async findById(userId: string, id: string): Promise<UnifiedFinding | null> {
    const key = `${userId}:${id}`;
    const found = this.store.get(key);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async findByCategory(
    userId: string,
    category: FindingCategory,
    options?: PaginationOptions
  ): Promise<UnifiedFinding[]> {
    const prefix = `${userId}:`;
    const results: UnifiedFinding[] = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix) && v.category === category) {
        results.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return applyPagination(results, options);
  }

  async listByUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<UnifiedFinding[]> {
    const prefix = `${userId}:`;
    const results: UnifiedFinding[] = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        results.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return applyPagination(results, options);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const key = `${userId}:${id}`;
    return this.store.delete(key);
  }

  async countByUser(userId: string): Promise<number> {
    const prefix = `${userId}:`;
    let count = 0;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) count++;
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }
}

export class InMemoryEntityRepository implements IEntityRepository {
  private store = new Map<string, IntelligenceEntity>();

  async save(entity: IntelligenceEntity): Promise<void> {
    IntelligenceEntitySchema.parse(entity);
    const key = `${entity.userId}:${entity.id}`;
    this.store.set(key, JSON.parse(JSON.stringify(entity)));
  }

  async saveBatch(entities: IntelligenceEntity[]): Promise<void> {
    for (const e of entities) {
      await this.save(e);
    }
  }

  async findById(userId: string, id: string): Promise<IntelligenceEntity | null> {
    const key = `${userId}:${id}`;
    const found = this.store.get(key);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async findByPrimaryValue(
    userId: string,
    type: EntityType,
    primaryValue: string
  ): Promise<IntelligenceEntity | null> {
    const prefix = `${userId}:`;
    const normalized = primaryValue.trim().toLowerCase();
    for (const [k, v] of this.store.entries()) {
      if (
        k.startsWith(prefix) &&
        v.type === type &&
        v.primaryValue.trim().toLowerCase() === normalized
      ) {
        return JSON.parse(JSON.stringify(v));
      }
    }
    return null;
  }

  async listByUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<IntelligenceEntity[]> {
    const prefix = `${userId}:`;
    const results: IntelligenceEntity[] = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        results.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return applyPagination(results, options);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const key = `${userId}:${id}`;
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class InMemoryRelationshipRepository implements IRelationshipRepository {
  private store = new Map<string, IntelligenceRelationship>();

  async save(relationship: IntelligenceRelationship): Promise<void> {
    IntelligenceRelationshipSchema.parse(relationship);
    const key = `${relationship.userId}:${relationship.id}`;
    this.store.set(key, JSON.parse(JSON.stringify(relationship)));
  }

  async saveBatch(relationships: IntelligenceRelationship[]): Promise<void> {
    for (const r of relationships) {
      await this.save(r);
    }
  }

  async findById(
    userId: string,
    id: string
  ): Promise<IntelligenceRelationship | null> {
    const key = `${userId}:${id}`;
    const found = this.store.get(key);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async listByUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<IntelligenceRelationship[]> {
    const prefix = `${userId}:`;
    const results: IntelligenceRelationship[] = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        results.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return applyPagination(results, options);
  }

  async findByEntity(
    userId: string,
    entityId: string
  ): Promise<IntelligenceRelationship[]> {
    const prefix = `${userId}:`;
    const results: IntelligenceRelationship[] = [];
    for (const [k, v] of this.store.entries()) {
      if (
        k.startsWith(prefix) &&
        (v.sourceEntityId === entityId || v.targetEntityId === entityId)
      ) {
        results.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return results;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const key = `${userId}:${id}`;
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class InMemoryEvidenceRepository implements IEvidenceRepository {
  private store = new Map<string, EvidenceItem>();

  async save(evidence: EvidenceItem): Promise<void> {
    EvidenceItemSchema.parse(evidence);
    const key = `${evidence.userId}:${evidence.id}`;
    this.store.set(key, JSON.parse(JSON.stringify(evidence)));
  }

  async saveBatch(evidenceList: EvidenceItem[]): Promise<void> {
    for (const ev of evidenceList) {
      await this.save(ev);
    }
  }

  async findById(userId: string, id: string): Promise<EvidenceItem | null> {
    const key = `${userId}:${id}`;
    const found = this.store.get(key);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async findByFingerprint(
    userId: string,
    fingerprint: string
  ): Promise<EvidenceItem | null> {
    const prefix = `${userId}:`;
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix) && v.provenance.fingerprint === fingerprint) {
        return JSON.parse(JSON.stringify(v));
      }
    }
    return null;
  }

  async findByFindingId(
    userId: string,
    findingId: string
  ): Promise<EvidenceItem[]> {
    const prefix = `${userId}:`;
    const results: EvidenceItem[] = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix) && v.findingId === findingId) {
        results.push(JSON.parse(JSON.stringify(v)));
      }
    }
    return results;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const key = `${userId}:${id}`;
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
