import { describe, it, expect } from "vitest";
import { RiskEngine } from "@/lib/intelligence/risk/riskEngine";
import { createUnifiedFinding } from "@/lib/intelligence/core/finding";
import { evaluateConfidence } from "@/lib/intelligence/core/confidence";

describe("Risk Engine & What-If Simulator", () => {
  const engine = new RiskEngine();
  const conf = evaluateConfidence({
    reliability: "RELIABLE",
    evidenceCount: 1,
  });

  it("evaluates risk score and generates explainable factors", () => {
    const finding1 = createUnifiedFinding({
      userId: "usr_test",
      category: "SECURITY",
      subcategory: "BREACH",
      title: "Breach 1",
      description: "Leaked credentials",
      source: "breach",
      confidence: conf,
      severity: "CRITICAL",
      payload: {
        category: "SECURITY",
        serviceName: "Acme Corp",
        eventType: "BREACH_EXPOSURE",
        isRemediationConfirmedByUser: false,
      },
    });

    const finding2 = createUnifiedFinding({
      userId: "usr_test",
      category: "PRIVACY",
      subcategory: "DORMANT",
      title: "Dormant Service",
      description: "Inactive for 400 days",
      source: "gmail",
      confidence: conf,
      severity: "LOW",
      payload: {
        category: "PRIVACY",
        serviceName: "OldForum",
        domain: "oldforum.com",
        daysSinceLastActivity: 450,
      },
    });

    const evalResult = engine.evaluateFindings([finding1, finding2]);

    expect(evalResult.score).toBeGreaterThanOrEqual(40);
    expect(evalResult.factors).toHaveLength(2);
    expect(evalResult.isSimulation).toBe(false);
    expect(evalResult.factors.some((f) => f.title.includes("Acme Corp"))).toBe(true);
    expect(evalResult.factors.some((f) => f.title.includes("OldForum"))).toBe(true);
  });

  it("does not penalize breach findings when user verified remediation", () => {
    const finding = createUnifiedFinding({
      userId: "usr_test",
      category: "SECURITY",
      subcategory: "BREACH",
      title: "Remediated Breach",
      description: "Leaked credentials",
      source: "breach",
      confidence: conf,
      severity: "HIGH",
      payload: {
        category: "SECURITY",
        serviceName: "SafeService",
        eventType: "BREACH_EXPOSURE",
        isRemediationConfirmedByUser: true,
      },
    });

    const evalResult = engine.evaluateFindings([finding]);
    const factor = evalResult.factors.find((f) => f.category === "REMEDIATION_STATUS");
    expect(factor).toBeDefined();
    expect(factor?.scoreContribution).toBe(0);
  });

  it("simulates risk reduction cleanly without mutating the original assessment", () => {
    const finding = createUnifiedFinding({
      userId: "usr_test",
      category: "SECURITY",
      subcategory: "BREACH",
      title: "Breach",
      description: "Leaked credentials",
      source: "breach",
      confidence: conf,
      severity: "CRITICAL",
      payload: {
        category: "SECURITY",
        serviceName: "BankService",
        eventType: "BREACH_EXPOSURE",
        isRemediationConfirmedByUser: false,
      },
    });

    const original = engine.evaluateFindings([finding]);
    const breachFactor = original.factors[0];

    const simulated = engine.simulateRemediation(original, [
      { factorId: breachFactor.id, actionType: "ROTATE_PASSWORD" },
    ]);

    expect(simulated.isSimulation).toBe(true);
    expect(simulated.score).toBeLessThan(original.score);
    expect(simulated.summaryExplanation).toContain("[SIMULATION]");

    // Original remains unchanged
    expect(original.isSimulation).toBe(false);
    expect(original.factors[0].scoreContribution).toBeGreaterThan(0);
  });
});
