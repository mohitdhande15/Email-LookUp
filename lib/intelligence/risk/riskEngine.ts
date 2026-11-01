import { type UnifiedFinding } from "../core/finding";

export type RiskSeverityTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ExplainableRiskFactor {
  id: string;
  category:
    | "BREACH_EXPOSURE"
    | "CREDENTIAL_VULNERABILITY"
    | "DORMANCY_AND_INACTIVITY"
    | "DATA_SENSITIVITY"
    | "EVIDENCE_CONFIDENCE"
    | "REMEDIATION_STATUS";
  title: string;
  description: string;
  scoreContribution: number;
  isSimulated?: boolean;
  remediationAction?: string;
  sourceFindingId?: string;
}

export interface RiskEvaluationResult {
  score: number;               // 0 to 100
  tier: RiskSeverityTier;
  factors: ExplainableRiskFactor[];
  isSimulation: boolean;
  summaryExplanation: string;
  assessedAt: string;
}

export interface SimulationAction {
  factorId: string;
  actionType: "ENABLE_MFA" | "ROTATE_PASSWORD" | "DELETE_ACCOUNT" | "CONFIRM_REMEDIATION";
}

export class RiskEngine {
  /**
   * Evaluates comprehensive risk based on findings and evidence.
   */
  evaluateFindings(findings: UnifiedFinding[]): RiskEvaluationResult {
    let score = 10; // Baseline identity footprint score
    const factors: ExplainableRiskFactor[] = [];

    for (const f of findings) {
      if (f.category === "SECURITY" && f.payload.category === "SECURITY") {
        const payload = f.payload;

        if (payload.eventType === "BREACH_EXPOSURE") {
          if (payload.isRemediationConfirmedByUser) {
            factors.push({
              id: `breach_mitigated_${f.id}`,
              category: "REMEDIATION_STATUS",
              title: "Verified Breach Remediation",
              description: `User verified credential rotation for breach on ${payload.serviceName}.`,
              scoreContribution: 0,
              remediationAction: "Maintain periodic review.",
              sourceFindingId: f.id,
            });
          } else {
            const breachContribution = f.severity === "CRITICAL" ? 30 : 20;
            score += breachContribution;
            factors.push({
              id: `breach_unmitigated_${f.id}`,
              category: "BREACH_EXPOSURE",
              title: `Unmitigated Breach Exposure: ${payload.serviceName}`,
              description: `Known breach records exist with no user-confirmed password rotation.`,
              scoreContribution: breachContribution,
              remediationAction: `Rotate credentials on ${payload.serviceName} and check password reuse.`,
              sourceFindingId: f.id,
            });
          }
        }

        if (payload.eventType === "MFA_DISABLED") {
          score += 30;
          factors.push({
            id: `mfa_disabled_${f.id}`,
            category: "CREDENTIAL_VULNERABILITY",
            title: `Critical: MFA Disabled on ${payload.serviceName}`,
            description: "Multi-factor authentication was disabled or removed, leaving account exposed to credential stuffing.",
            scoreContribution: 30,
            remediationAction: `Re-enable Multi-Factor Authentication immediately on ${payload.serviceName}.`,
            sourceFindingId: f.id,
          });
        }

        if (payload.eventType === "UNFAMILIAR_DEVICE_LOGIN" || payload.eventType === "SUSPICIOUS_ACTIVITY") {
          score += 20;
          factors.push({
            id: `suspicious_login_${f.id}`,
            category: "CREDENTIAL_VULNERABILITY",
            title: `Unfamiliar / Suspicious Login: ${payload.serviceName}`,
            description: "An unconfirmed login alert or security warning was observed from an unfamiliar device or IP.",
            scoreContribution: 20,
            remediationAction: `Revoke active sessions and confirm account security settings on ${payload.serviceName}.`,
            sourceFindingId: f.id,
          });
        }

        if (payload.eventType === "RECOVERY_INFO_CHANGED") {
          score += 15;
          factors.push({
            id: `recovery_changed_${f.id}`,
            category: "CREDENTIAL_VULNERABILITY",
            title: `Recovery Info Changed: ${payload.serviceName}`,
            description: "Secondary email or phone was updated. Verify this modification was authorized.",
            scoreContribution: 15,
            remediationAction: `Check recovery options on ${payload.serviceName}.`,
            sourceFindingId: f.id,
          });
        }
      }

      if (f.category === "PRIVACY" && f.payload.category === "PRIVACY") {
        const p = f.payload;
        if (p.daysSinceLastActivity && p.daysSinceLastActivity > 365) {
          score += 12;
          factors.push({
            id: `dormant_service_${f.id}`,
            category: "DORMANCY_AND_INACTIVITY",
            title: `Dormant Account: ${p.serviceName}`,
            description: `No recorded activity for over 1 year (${p.daysSinceLastActivity} days). Increases attack surface.`,
            scoreContribution: 12,
            remediationAction: `Delete or close inactive account on ${p.serviceName}.`,
            sourceFindingId: f.id,
          });
        }
      }
    }

    const boundedScore = Math.max(0, Math.min(100, score));
    const tier = this.resolveTier(boundedScore);

    return {
      score: boundedScore,
      tier,
      factors,
      isSimulation: false,
      summaryExplanation: `Assessed risk score of ${boundedScore}/100 (${tier}). Supported by ${factors.length} explainable factor(s).`,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * What-If Simulator: Projects how score changes if specific remediations are completed.
   * Explicitly labeled as simulated.
   */
  simulateRemediation(
    current: RiskEvaluationResult,
    actions: SimulationAction[]
  ): RiskEvaluationResult {
    const actionSet = new Set(actions.map((a) => a.factorId));
    let simulatedScore = current.score;
    const simulatedFactors: ExplainableRiskFactor[] = [];

    for (const factor of current.factors) {
      if (actionSet.has(factor.id)) {
        simulatedScore -= factor.scoreContribution;
        simulatedFactors.push({
          ...factor,
          scoreContribution: 0,
          isSimulated: true,
          description: `[SIMULATED REMEDIATION]: ${factor.description}`,
        });
      } else {
        simulatedFactors.push({ ...factor });
      }
    }

    const bounded = Math.max(0, Math.min(100, simulatedScore));
    const tier = this.resolveTier(bounded);

    return {
      score: bounded,
      tier,
      factors: simulatedFactors,
      isSimulation: true,
      summaryExplanation: `[SIMULATION] Projected risk score of ${bounded}/100 if ${actions.length} remediation action(s) are completed.`,
      assessedAt: new Date().toISOString(),
    };
  }

  private resolveTier(score: number): RiskSeverityTier {
    if (score >= 75) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 25) return "MEDIUM";
    return "LOW";
  }
}

export const defaultRiskEngine = new RiskEngine();
