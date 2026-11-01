import {
  type UnifiedFinding,
  createUnifiedFinding,
} from "../core/finding";
import {
  type IntelligenceEntity,
  createIntelligenceEntity,
} from "../core/entity";
import {
  type IntelligenceRelationship,
  createIntelligenceRelationship,
} from "../core/relationship";
import { type EvidenceItem } from "../core/evidence";
import { evaluateConfidence } from "../core/confidence";
import { TransactionExtractor, type RawEmailFinancialInput } from "./transactionExtractor";
import { SubscriptionDetector } from "./subscriptionDetector";
import { TrialDetector } from "./trialDetector";
import { PriceChangeDetector } from "./priceChangeDetector";
import { RecurringPaymentAnalyzer } from "./recurringPaymentAnalyzer";
import { FinancialEvidenceBuilder } from "./financialEvidence";
import {
  type ExtractedTransaction,
  type SubscriptionRecord,
  type TrialRecord,
  type PriceChangeEvent,
  type FinancialSummary,
  type CurrencyCode,
} from "./financialTypes";

export interface FinancialExtractionInput {
  userId: string;
  senderDomain: string;
  merchantDisplayName: string;
  emailSubject: string;
  emailDate: string;
  listUnsubscribePresent?: boolean;
  snippet?: string;
  messageId?: string;
}

export interface FinancialAnalysisResult {
  findings: UnifiedFinding[];
  entities: IntelligenceEntity[];
  relationships: IntelligenceRelationship[];
  evidence: EvidenceItem[];
  subscriptions: SubscriptionRecord[];
  trials: TrialRecord[];
  priceAlerts: PriceChangeEvent[];
  transactions: ExtractedTransaction[];
  summary: FinancialSummary;
}

export interface IFinancialEngine {
  analyzeTransactions(
    userId: string,
    rawInputs: RawEmailFinancialInput[],
    preferredCurrency?: CurrencyCode
  ): Promise<FinancialAnalysisResult>;
  analyzeTransactionMetadata(
    inputs: FinancialExtractionInput[]
  ): Promise<FinancialAnalysisResult>;
}

export class FinancialEngine implements IFinancialEngine {
  /**
   * Main entrypoint: Processes raw candidate emails from Gmail, extracts transactions,
   * detects subscriptions, monitors trials, identifies price changes, and produces
   * unified findings, entities, and relationships.
   */
  async analyzeTransactions(
    userId: string,
    rawInputs: RawEmailFinancialInput[],
    preferredCurrency: CurrencyCode = "USD"
  ): Promise<FinancialAnalysisResult> {
    if (!rawInputs || !rawInputs.length) {
      return this.emptyResult(preferredCurrency);
    }

    // 1. Extract transactions from candidate emails
    const transactions: ExtractedTransaction[] = rawInputs.map((input) =>
      TransactionExtractor.extract(input)
    );

    // 2. Build Evidence items (zero raw message bodies stored)
    const evidenceItems: EvidenceItem[] = transactions.map((tx) =>
      FinancialEvidenceBuilder.buildTransactionEvidence(userId, tx)
    );

    // 3. Group transactions by merchant
    const merchantMap = new Map<string, ExtractedTransaction[]>();
    for (const tx of transactions) {
      if (!merchantMap.has(tx.merchantName)) {
        merchantMap.set(tx.merchantName, []);
      }
      merchantMap.get(tx.merchantName)!.push(tx);
    }

    // 4. Detect Subscriptions across merchants
    const subscriptions: SubscriptionRecord[] = [];
    for (const txs of merchantMap.values()) {
      const detected = SubscriptionDetector.evaluateMerchantSubscriptions(txs);
      subscriptions.push(...detected);
    }

    // 5. Detect Free Trials
    const trials: TrialRecord[] = TrialDetector.detectTrials(transactions);

    // 6. Detect Price Changes
    const priceAlerts: PriceChangeEvent[] = PriceChangeDetector.detectPriceChanges(transactions);

    // 7. Generate Aggregate Financial Summary
    const summary = RecurringPaymentAnalyzer.generateSummary(
      subscriptions,
      transactions,
      trials.filter((t) => t.status === "ACTIVE" || t.status === "EXPIRING_SOON").length,
      priceAlerts.length,
      preferredCurrency
    );

    // 8. Construct Root User Entity for Relationship Linking
    const rootUserEntity = createIntelligenceEntity({
      userId,
      type: "EMAIL_IDENTITY",
      primaryValue: userId,
      displayName: "User Digital Identity",
      confidence: evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: 1,
        isCryptographicOrDirect: true,
      }),
    });

    const entities: IntelligenceEntity[] = [rootUserEntity];
    const relationships: IntelligenceRelationship[] = [];
    const findings: UnifiedFinding[] = [];

    // 9. Convert Subscriptions to Unified Findings & Entities
    for (const sub of subscriptions) {
      const subConfidence = evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: sub.transactionCount,
        isCryptographicOrDirect: sub.verificationStatus === "CONFIRMED_FACT",
      });

      const subEntity = createIntelligenceEntity({
        userId,
        type: "SUBSCRIPTION",
        primaryValue: sub.canonicalDomain,
        displayName: sub.merchantName,
        confidence: subConfidence,
        attributes: {
          category: sub.category,
          billingFrequency: sub.billingFrequency,
          estimatedMonthlyCost: sub.estimatedMonthlyCost,
          estimatedAnnualCost: sub.estimatedAnnualCost,
          currency: sub.currency,
          lastDetectedDate: sub.lastDetectedDate,
          nextRenewalDate: sub.nextRenewalDate,
        },
      });
      entities.push(subEntity);

      const subRelationship = createIntelligenceRelationship({
        userId,
        sourceEntityId: rootUserEntity.id,
        targetEntityId: subEntity.id,
        type: "SUBSCRIBED_TO",
        source: "financial_intelligence_engine",
        evidenceIds: sub.evidenceIds,
        confidence: subConfidence,
      });
      relationships.push(subRelationship);

      const actions = [
        {
          id: `act_sub_${sub.id}`,
          type: "CANCEL_SUBSCRIPTION" as const,
          label: `Manage or Cancel ${sub.merchantName}`,
          description: `Direct cancellation or plan management for ${sub.merchantName}.`,
          actionUrl: sub.cancellationUrl,
          priority: sub.severity === "HIGH" ? ("RECOMMENDED" as const) : ("OPTIONAL" as const),
        },
      ];

      const finding = createUnifiedFinding({
        userId,
        category: "FINANCIAL",
        subcategory: "RECURRING_SUBSCRIPTION",
        title: `${sub.merchantName} Subscription (${sub.billingFrequency.toLowerCase()})`,
        description: `Active ${sub.category} subscription detected for ${sub.merchantName}. Estimated monthly cost: ${sub.currency} ${sub.estimatedMonthlyCost.toFixed(2)}. Last billed on ${sub.lastDetectedDate.slice(0, 10)}${sub.nextRenewalDate ? `, next renewal projected on ${sub.nextRenewalDate.slice(0, 10)}.` : "."}`,
        source: "financial_subscription_detector",
        sourceReference: sub.canonicalDomain,
        eventAt: sub.lastDetectedDate,
        confidence: subConfidence,
        severity: sub.severity,
        evidence: evidenceItems,
        relatedEntityIds: [rootUserEntity.id, subEntity.id],
        recommendedActions: actions,
        payload: {
          category: "FINANCIAL",
          merchantName: sub.merchantName,
          estimatedAmount: sub.lastAmount,
          currency: sub.currency,
          billingFrequency: sub.billingFrequency,
          lastBilledDate: sub.lastDetectedDate,
          renewalDate: sub.nextRenewalDate,
          isFreeTrial: false,
        },
      });
      findings.push(finding);
    }

    // 10. Convert Trials to Unified Findings
    for (const trial of trials) {
      const trialConfidence = evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: 1,
        isCryptographicOrDirect: trial.status === "CANCELLED",
      });

      const actions = [
        {
          id: `act_trial_${trial.id}`,
          type: "CANCEL_SUBSCRIPTION" as const,
          label: `Cancel ${trial.serviceName} Trial`,
          description: trial.cancellationGuide || `Cancel before ${trial.trialExpirationDate.slice(0, 10)} to prevent automatic charging.`,
          actionUrl: trial.cancellationUrl,
          priority: trial.daysRemaining <= 3 ? ("IMMEDIATE" as const) : ("RECOMMENDED" as const),
        },
      ];

      const finding = createUnifiedFinding({
        userId,
        category: "FINANCIAL",
        subcategory: "FREE_TRIAL_MONITOR",
        title: `${trial.serviceName} Free Trial (${trial.daysRemaining >= 0 ? `${trial.daysRemaining} days left` : "Expired"})`,
        description: `Free trial for ${trial.serviceName} started on ${trial.trialStartDate.slice(0, 10)} and expires on ${trial.trialExpirationDate.slice(0, 10)}.${trial.expectedPostTrialAmount ? ` Expected billing after trial: ${trial.currency || "USD"} ${trial.expectedPostTrialAmount}.` : ""}`,
        source: "financial_trial_detector",
        sourceReference: trial.canonicalDomain,
        eventAt: trial.trialStartDate,
        confidence: trialConfidence,
        severity: trial.daysRemaining <= 3 && trial.status !== "CANCELLED" ? "HIGH" : "MEDIUM",
        evidence: evidenceItems,
        relatedEntityIds: [rootUserEntity.id],
        recommendedActions: actions,
        payload: {
          category: "FINANCIAL",
          merchantName: trial.serviceName,
          estimatedAmount: trial.expectedPostTrialAmount,
          currency: trial.currency,
          trialExpirationDate: trial.trialExpirationDate,
          isFreeTrial: true,
        },
      });
      findings.push(finding);
    }

    // 11. Convert Price Changes to Unified Findings
    for (const alert of priceAlerts) {
      const alertConfidence = evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: alert.evidenceIds.length,
        hasConflictingSignals: alert.isAmbiguous,
      });

      const finding = createUnifiedFinding({
        userId,
        category: "FINANCIAL",
        subcategory: "PRICE_HIKE_ALERT",
        title: `Price Change Alert: ${alert.merchantName} (${alert.percentageChange > 0 ? "+" : ""}${alert.percentageChange}%)`,
        description: `Detected recurring amount shift for ${alert.merchantName} from ${alert.currency} ${alert.previousAmount.toFixed(2)} to ${alert.currency} ${alert.newAmount.toFixed(2)} on ${alert.effectiveDate.slice(0, 10)}.${alert.isAmbiguous ? ` Note: ${alert.ambiguityReason}` : ""}`,
        source: "financial_price_change_detector",
        sourceReference: alert.canonicalDomain,
        eventAt: alert.effectiveDate,
        confidence: alertConfidence,
        severity: alert.percentageChange > 20 && !alert.isAmbiguous ? "HIGH" : "MEDIUM",
        evidence: evidenceItems,
        relatedEntityIds: [rootUserEntity.id],
        recommendedActions: [
          {
            id: `act_prc_${alert.id}`,
            type: "REVIEW_PERMISSIONS" as const,
            label: `Review ${alert.merchantName} Plan`,
            description: `Verify if rate change matches your desired subscription tier.`,
            priority: "RECOMMENDED" as const,
          },
        ],
        payload: {
          category: "FINANCIAL",
          merchantName: alert.merchantName,
          estimatedAmount: alert.newAmount,
          currency: alert.currency,
          billingFrequency: alert.billingFrequency,
          isPriceIncreaseAlert: alert.percentageChange > 0,
          priceDeltaPercentage: alert.percentageChange,
        },
      });
      findings.push(finding);
    }

    return {
      findings,
      entities,
      relationships,
      evidence: evidenceItems,
      subscriptions,
      trials,
      priceAlerts,
      transactions,
      summary,
    };
  }

  /**
   * Compatibility adapter for the previous IFinancialEngine metadata input.
   */
  async analyzeTransactionMetadata(
    inputs: FinancialExtractionInput[]
  ): Promise<FinancialAnalysisResult> {
    if (!inputs.length) {
      return this.emptyResult("USD");
    }

    const userId = inputs[0].userId;
    const rawInputs: RawEmailFinancialInput[] = inputs.map((inp, idx) => ({
      messageId: inp.messageId || `msg_${idx}`,
      senderDomain: inp.senderDomain,
      senderDisplayName: inp.merchantDisplayName,
      subject: inp.emailSubject,
      dateStr: inp.emailDate,
      snippet: inp.snippet,
    }));

    return this.analyzeTransactions(userId, rawInputs);
  }

  private emptyResult(currency: CurrencyCode): FinancialAnalysisResult {
    return {
      findings: [],
      entities: [],
      relationships: [],
      evidence: [],
      subscriptions: [],
      trials: [],
      priceAlerts: [],
      transactions: [],
      summary: {
        estimatedMonthlyRecurringCost: 0,
        estimatedAnnualRecurringCost: 0,
        totalActiveSubscriptions: 0,
        activeTrialsCount: 0,
        priceHikeAlertsCount: 0,
        primaryCurrency: currency,
        spendingByMerchant: [],
        spendingByCurrency: {},
        spendingByCategory: {},
        billingFrequencyDistribution: {
          MONTHLY: 0,
          ANNUAL: 0,
          QUARTERLY: 0,
          WEEKLY: 0,
          ONE_OFF: 0,
          UNKNOWN: 0,
        },
        historicalSpendingTrend: [],
      },
    };
  }
}

export const defaultFinancialEngine = new FinancialEngine();
