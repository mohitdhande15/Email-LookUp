import { type UnifiedFinding, type FindingAction } from "../core/finding";

export interface PrioritizedAction extends FindingAction {
  category: string;
  sourceFindingId: string;
  weight: number;
  evidenceExplanation?: string;
}

export class RecommendationEngine {
  /**
   * Aggregates, deduplicates, and ranks recommended actions across all findings,
   * with specialized financial, security, identity, and privacy heuristics.
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

        // Specialized Financial heuristics
        if (finding.category === "FINANCIAL") {
          // Free trial ending within 3 days is top priority
          if (finding.subcategory === "FREE_TRIAL_MONITOR" && finding.severity === "HIGH") {
            weight += 60;
          }
          // High price hikes get elevated priority
          if (finding.subcategory === "PRICE_HIKE_ALERT" && finding.severity === "HIGH") {
            weight += 30;
          }
        }

        const dedupeKey = `${action.type}:${action.label.toLowerCase()}`;
        const existing = actionMap.get(dedupeKey);

        const explanation =
          finding.evidence && finding.evidence.length > 0
            ? finding.evidence[0].summary
            : finding.description;

        if (!existing || weight > existing.weight) {
          actionMap.set(dedupeKey, {
            ...action,
            category: finding.category,
            sourceFindingId: finding.id,
            weight,
            evidenceExplanation: explanation,
          });
        }
      }
    }

    // Identify duplicate financial subscriptions (e.g. 2+ subscriptions in the same category)
    const financialFindings = findings.filter((f) => f.category === "FINANCIAL" && f.subcategory === "RECURRING_SUBSCRIPTION");
    const categoryCounts = new Map<string, UnifiedFinding[]>();

    for (const f of financialFindings) {
      const payload = f.payload as { merchantName?: string };
      const merchant = payload?.merchantName || f.title;
      const key = f.sourceReference || merchant;
      if (!categoryCounts.has(key)) {
        categoryCounts.set(key, []);
      }
      categoryCounts.get(key)!.push(f);
    }

    for (const [key, list] of categoryCounts.entries()) {
      if (list.length > 1) {
        const dedupeKey = `REVIEW_DUPLICATE_SUBSCRIPTION:${key}`;
        if (!actionMap.has(dedupeKey)) {
          actionMap.set(dedupeKey, {
            id: `act_dup_${Date.now()}_${key.replace(/[^a-z0-9]/gi, "_")}`,
            type: "INFORMATIONAL",
            label: `Review Multiple Subscriptions for ${list[0].title.split(" ")[0]}`,
            description: `Detected ${list.length} separate subscription records for ${key}. Verify if multiple seats or duplicate plans are active.`,
            priority: "RECOMMENDED",
            category: "FINANCIAL",
            sourceFindingId: list[0].id,
            weight: 45,
            evidenceExplanation: `Discovered multiple recurring subscriptions linked to ${key}.`,
          });
        }
      }
    }

    return Array.from(actionMap.values()).sort((a, b) => b.weight - a.weight);
  }
}

export const defaultRecommendationEngine = new RecommendationEngine();
