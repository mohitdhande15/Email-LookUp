import { type UnifiedFinding, type FindingAction } from "../core/finding";

export interface PrioritizedAction extends FindingAction {
  category: string;
  sourceFindingId: string;
  weight: number;
}

export class RecommendationEngine {
  /**
   * Aggregates, deduplicates, and ranks recommended actions across findings.
   */
  generateActionPlan(findings: UnifiedFinding[]): PrioritizedAction[] {
    const actionMap = new Map<string, PrioritizedAction>();

    for (const finding of findings) {
      for (const action of finding.recommendedActions) {
        let weight = 10;
        if (action.priority === "IMMEDIATE") weight = 100;
        else if (action.priority === "RECOMMENDED") weight = 50;

        // Give extra weight to critical/high severity findings
        if (finding.severity === "CRITICAL") weight += 40;
        else if (finding.severity === "HIGH") weight += 20;

        const dedupeKey = `${action.type}:${action.label.toLowerCase()}`;

        const existing = actionMap.get(dedupeKey);
        if (!existing || weight > existing.weight) {
          actionMap.set(dedupeKey, {
            ...action,
            category: finding.category,
            sourceFindingId: finding.id,
            weight,
          });
        }
      }
    }

    return Array.from(actionMap.values()).sort((a, b) => b.weight - a.weight);
  }
}

export const defaultRecommendationEngine = new RecommendationEngine();
