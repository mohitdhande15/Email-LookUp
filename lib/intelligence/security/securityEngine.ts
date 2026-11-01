import { type UnifiedFinding } from "../core/finding";
import { type IntelligenceEntity } from "../core/entity";
import { type IntelligenceRelationship } from "../core/relationship";
import { type EvidenceItem } from "../core/evidence";

export interface SecurityEventInput {
  userId: string;
  sourceDomain: string;
  serviceName: string;
  subject: string;
  timestamp: string;
}

export interface SecurityAnalysisResult {
  findings: UnifiedFinding[];
  entities: IntelligenceEntity[];
  relationships: IntelligenceRelationship[];
  evidence: EvidenceItem[];
}

/**
 * Security Intelligence Engine Interface.
 * Architectural foundation for security event timeline, emergency lockdown, and credential alerts.
 * Full event detection is implemented in Phase 3.
 */
export interface ISecurityEngine {
  processSecurityEvents(
    inputs: SecurityEventInput[]
  ): Promise<SecurityAnalysisResult>;
}

export class SecurityEngine implements ISecurityEngine {
  async processSecurityEvents(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _inputs: SecurityEventInput[]
  ): Promise<SecurityAnalysisResult> {
    return {
      findings: [],
      entities: [],
      relationships: [],
      evidence: [],
    };
  }
}

export const defaultSecurityEngine = new SecurityEngine();
