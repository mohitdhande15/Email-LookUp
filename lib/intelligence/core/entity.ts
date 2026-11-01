import { type ConfidenceAssessment } from "./confidence";

export type EntityType =
  | "EMAIL_IDENTITY"
  | "PERSON_PROFILE"
  | "ORGANIZATION"
  | "DOMAIN"
  | "PLATFORM_ACCOUNT"
  | "SUBSCRIPTION"
  | "SECURITY_EVENT"
  | "DATA_BREACH"
  | "OAUTH_APPLICATION"
  | "CRYPTOGRAPHIC_IDENTITY";

export interface IntelligenceEntity {
  id: string;
  userId: string;
  type: EntityType;
  primaryValue: string;      // e.g. "alice@example.com", "github.com", "Netflix"
  displayName: string;       // Clean human-facing label
  attributes: Record<string, unknown>;
  firstObservedAt: string;   // ISO-8601
  lastObservedAt: string;    // ISO-8601
  confidence: ConfidenceAssessment;
  metadata?: Record<string, unknown>;
}

/**
 * Clean Graph Node structure for downstream visualization (Three.js / React Flow / SVG).
 */
export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  primaryValue: string;
  category: "PRIMARY" | "SERVICE" | "THREAT" | "SECURITY" | "FINANCIAL";
  confidenceScore: number;
  isConfirmed: boolean;
  attributes: Record<string, unknown>;
}

export function projectEntityToGraphNode(entity: IntelligenceEntity): GraphNode {
  let category: GraphNode["category"];

  switch (entity.type) {
    case "EMAIL_IDENTITY":
    case "PERSON_PROFILE":
    case "CRYPTOGRAPHIC_IDENTITY":
      category = "PRIMARY";
      break;
    case "DATA_BREACH":
    case "SECURITY_EVENT":
      category = "THREAT";
      break;
    case "SUBSCRIPTION":
      category = "FINANCIAL";
      break;
    case "OAUTH_APPLICATION":
      category = "SECURITY";
      break;
    case "PLATFORM_ACCOUNT":
    case "DOMAIN":
    case "ORGANIZATION":
    default:
      category = "SERVICE";
      break;
  }

  return {
    id: entity.id,
    label: entity.displayName,
    type: entity.type,
    primaryValue: entity.primaryValue,
    category,
    confidenceScore: entity.confidence.score,
    isConfirmed: entity.confidence.isConfirmed,
    attributes: entity.attributes,
  };
}

export function createIntelligenceEntity(params: {
  id?: string;
  userId: string;
  type: EntityType;
  primaryValue: string;
  displayName: string;
  attributes?: Record<string, unknown>;
  confidence: ConfidenceAssessment;
  firstObservedAt?: string;
  lastObservedAt?: string;
  metadata?: Record<string, unknown>;
}): IntelligenceEntity {
  const cleanValue = params.primaryValue.trim().toLowerCase();
  const id =
    params.id ??
    `ent_${params.type.toLowerCase()}_${cleanValue.replace(/[^a-z0-9]/g, "_").slice(0, 32)}`;
  const now = new Date().toISOString();

  return {
    id,
    userId: params.userId,
    type: params.type,
    primaryValue: params.primaryValue,
    displayName: params.displayName,
    attributes: params.attributes ?? {},
    firstObservedAt: params.firstObservedAt ?? now,
    lastObservedAt: params.lastObservedAt ?? now,
    confidence: params.confidence,
    metadata: params.metadata,
  };
}
