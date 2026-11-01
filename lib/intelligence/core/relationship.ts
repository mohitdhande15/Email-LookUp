import { type ConfidenceAssessment } from "./confidence";

export type RelationshipType =
  | "ASSOCIATED_WITH"      // Email is associated with a public developer profile or identity
  | "DISCOVERED_ON"        // Account discovered on a specific platform
  | "EXPOSED_IN"          // Entity was leaked in a specific data breach
  | "SUBSCRIBED_TO"        // User holds a recurring subscription with merchant
  | "AUTHENTICATED_WITH"   // Account authorized via OAuth provider
  | "RECEIVED_FROM"        // Mailbox communication received from a domain
  | "RELATED_TO";          // General contextual association

export interface IntelligenceRelationship {
  id: string;
  userId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  source: string;          // Source creating this relationship
  evidenceIds: string[];
  confidence: ConfidenceAssessment;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;          // Source Node ID
  target: string;          // Target Node ID
  type: RelationshipType;
  confidenceScore: number;
  isConfirmed: boolean;
  edgeStyle: "SOLID" | "DASHED" | "CRITICAL";
}

export function projectRelationshipToGraphEdge(
  rel: IntelligenceRelationship
): GraphEdge {
  let edgeStyle: GraphEdge["edgeStyle"] = "SOLID";

  if (rel.type === "EXPOSED_IN") {
    edgeStyle = "CRITICAL";
  } else if (!rel.confidence.isConfirmed) {
    edgeStyle = "DASHED";
  }

  return {
    id: rel.id,
    source: rel.sourceEntityId,
    target: rel.targetEntityId,
    type: rel.type,
    confidenceScore: rel.confidence.score,
    isConfirmed: rel.confidence.isConfirmed,
    edgeStyle,
  };
}

export function createIntelligenceRelationship(params: {
  id?: string;
  userId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  source: string;
  evidenceIds?: string[];
  confidence: ConfidenceAssessment;
  observedAt?: string;
  metadata?: Record<string, unknown>;
}): IntelligenceRelationship {
  const id =
    params.id ??
    `rel_${params.type.toLowerCase()}_${params.sourceEntityId}_${params.targetEntityId}`;

  return {
    id,
    userId: params.userId,
    sourceEntityId: params.sourceEntityId,
    targetEntityId: params.targetEntityId,
    type: params.type,
    source: params.source,
    evidenceIds: params.evidenceIds ?? [],
    confidence: params.confidence,
    observedAt: params.observedAt ?? new Date().toISOString(),
    metadata: params.metadata,
  };
}
