import { type UnifiedFinding } from "../core/finding";
import { type IntelligenceEntity } from "../core/entity";
import { type IntelligenceRelationship } from "../core/relationship";
import { type EvidenceItem } from "../core/evidence";

export interface FinancialExtractionInput {
  userId: string;
  senderDomain: string;
  merchantDisplayName: string;
  emailSubject: string;
  emailDate: string;
  listUnsubscribePresent: boolean;
}

export interface FinancialAnalysisResult {
  findings: UnifiedFinding[];
  entities: IntelligenceEntity[];
  relationships: IntelligenceRelationship[];
  evidence: EvidenceItem[];
}

/**
 * Financial Intelligence Engine Interface.
 * Architectural foundation for subscription radar, price hike detector, and free-trial tracker.
 * Full pattern extraction is implemented in Phase 2.
 */
export interface IFinancialEngine {
  analyzeTransactionMetadata(
    inputs: FinancialExtractionInput[]
  ): Promise<FinancialAnalysisResult>;
}

export class FinancialEngine implements IFinancialEngine {
  async analyzeTransactionMetadata(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _inputs: FinancialExtractionInput[]
  ): Promise<FinancialAnalysisResult> {
    // Foundation baseline returning structured result for future Phase 2 expansion
    return {
      findings: [],
      entities: [],
      relationships: [],
      evidence: [],
    };
  }
}

export const defaultFinancialEngine = new FinancialEngine();
