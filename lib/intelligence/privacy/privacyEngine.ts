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
import {
  type UnsubscribeCandidate,
  type EmailTrackerDetection,
  type OAuthAppRecord,
  type DataBrokerRecord,
  type CleanupAccountRecord,
  type LegalErasureTrackedRequest,
  type PrivacyIntelligenceSummary,
} from "./privacyTypes";
import { UnsubscribeDetector } from "./unsubscribe/unsubscribeDetector";
import { EmailPrivacyInspector } from "./email-privacy/emailPrivacyInspector";
import { OAuthPermissionAnalyzer } from "./oauth/oauthPermissionAnalyzer";
import { BrokerMatcher } from "./data-brokers/brokerMatcher";
import { CleanupStateMachine } from "./cleanup/cleanupStateMachine";
import { LegalDeadlineCalculator } from "./legal/legalDeadlineCalculator";
import { PrivacyEvidenceBuilder } from "./privacyEvidence";
import { PrivacyRecommendations } from "./privacyRecommendations";

export interface PrivacyInspectionInput {
  userId: string;
  domain: string;
  displayName: string;
  emailCount: number;
  daysAgo: number;
  hasUnsubscribeHeader: boolean;
  isBulkMail: boolean;
}

export interface RawEmailPrivacyInput {
  userId: string;
  domain: string;
  serviceName: string;
  senderEmail: string;
  subject: string;
  timestamp: string;
  messageId?: string;
  listUnsubscribeHeader?: string;
  listUnsubscribePostHeader?: string;
  bodySnippetOrHtml?: string;
  emailCount?: number;
  daysInactive?: number;
}

export interface PrivacyAnalysisResult {
  findings: UnifiedFinding[];
  entities: IntelligenceEntity[];
  relationships: IntelligenceRelationship[];
  evidence: EvidenceItem[];
  unsubscribeCandidates: UnsubscribeCandidate[];
  trackerDetections: EmailTrackerDetection[];
  oauthApps: OAuthAppRecord[];
  dataBrokers: DataBrokerRecord[];
  cleanupAccounts: CleanupAccountRecord[];
  legalRequests: LegalErasureTrackedRequest[];
  summary: PrivacyIntelligenceSummary;
}

export interface IPrivacyEngine {
  evaluatePrivacyStatus(
    inputs: PrivacyInspectionInput[]
  ): Promise<PrivacyAnalysisResult>;
  analyzePrivacyFootprint(
    userId: string,
    inputs: RawEmailPrivacyInput[],
    existingLegalRequests?: LegalErasureTrackedRequest[]
  ): Promise<PrivacyAnalysisResult>;
}

export class PrivacyEngine implements IPrivacyEngine {
  /**
   * Backwards-compatible interface implementation for simplified inspection inputs.
   */
  async evaluatePrivacyStatus(
    inputs: PrivacyInspectionInput[]
  ): Promise<PrivacyAnalysisResult> {
    if (inputs.length === 0) {
      return this.emptyResult();
    }

    const userId = inputs[0].userId;
    const rawInputs: RawEmailPrivacyInput[] = inputs.map((inp) => ({
      userId: inp.userId,
      domain: inp.domain,
      serviceName: inp.displayName,
      senderEmail: `notifications@${inp.domain}`,
      subject: `Updates from ${inp.displayName}`,
      timestamp: new Date().toISOString(),
      emailCount: inp.emailCount,
      daysInactive: inp.daysAgo,
      listUnsubscribeHeader: inp.hasUnsubscribeHeader
        ? `<https://${inp.domain}/unsubscribe>`
        : undefined,
    }));

    return this.analyzePrivacyFootprint(userId, rawInputs);
  }

  /**
   * Primary comprehensive analysis pipeline:
   * Inspects mailbox metadata, detects tracking pixels in memory, parses RFC 8058 unsubscribe headers,
   * detects OAuth grants, matches potential data brokers, and tracks account cleanup & legal requests.
   */
  async analyzePrivacyFootprint(
    userId: string,
    inputs: RawEmailPrivacyInput[],
    existingLegalRequests: LegalErasureTrackedRequest[] = []
  ): Promise<PrivacyAnalysisResult> {
    const findings: UnifiedFinding[] = [];
    const entities: IntelligenceEntity[] = [];
    const relationships: IntelligenceRelationship[] = [];
    const evidenceList: EvidenceItem[] = [];

    const unsubscribeCandidates: UnsubscribeCandidate[] = [];
    const trackerDetections: EmailTrackerDetection[] = [];
    const oauthApps: OAuthAppRecord[] = [];
    const cleanupAccounts: CleanupAccountRecord[] = [];

    const discoveredDomains = new Set<string>();

    // 1. Process Raw Mailbox Inputs
    for (const inp of inputs) {
      const cleanDomain = inp.domain.toLowerCase().trim();
      discoveredDomains.add(cleanDomain);

      // A. Unsubscribe Detection
      if (inp.listUnsubscribeHeader) {
        const candidate = UnsubscribeDetector.createCandidate({
          domain: cleanDomain,
          senderName: inp.serviceName,
          senderEmail: inp.senderEmail,
          listUnsubscribeHeader: inp.listUnsubscribeHeader,
          listUnsubscribePostHeader: inp.listUnsubscribePostHeader,
          emailCount: inp.emailCount,
        });

        unsubscribeCandidates.push(candidate);
        const unsubEv = PrivacyEvidenceBuilder.buildUnsubscribeEvidence(userId, candidate);
        evidenceList.push(unsubEv);

        const confidence = evaluateConfidence({
          reliability: "AUTHORITATIVE",
          evidenceCount: 1,
          isCryptographicOrDirect: true,
        });

        const finding = createUnifiedFinding({
          userId,
          category: "PRIVACY",
          subcategory: "UNSUBSCRIBE_RADAR",
          title: `Mailing list discovered: ${candidate.senderName}`,
          description: `Discovered mailing list from ${candidate.domain} with ${candidate.mechanism} unsubscribe support (${candidate.emailCount} emails received).`,
          source: "gmail_header_inspection",
          sourceReference: candidate.id,
          eventAt: inp.timestamp,
          confidence,
          severity: candidate.frequencyRating === "DAILY" ? "MEDIUM" : "LOW",
          evidence: [unsubEv],
          recommendedActions: [PrivacyRecommendations.forUnsubscribe(candidate)],
          payload: {
            category: "PRIVACY",
            serviceName: candidate.senderName,
            domain: candidate.domain,
            isMarketingList: true,
            unsubscribeUrl: candidate.targetUrl,
            rfc8058Compliant: candidate.mechanism === "RFC_8058_POST",
          },
        });
        findings.push(finding);
      }

      // B. Email Privacy Inspector (Tracking Pixels & Telemetry)
      if (inp.bodySnippetOrHtml) {
        const detection = EmailPrivacyInspector.inspect({
          messageId: inp.messageId ?? `msg_${Math.random().toString(36).slice(2, 8)}`,
          senderDomain: cleanDomain,
          senderEmail: inp.senderEmail,
          subject: inp.subject,
          receivedAt: inp.timestamp,
          bodySnippetOrHtml: inp.bodySnippetOrHtml,
        });

        if (detection) {
          trackerDetections.push(detection);
          const trackerEv = PrivacyEvidenceBuilder.buildTrackerEvidence(userId, detection);
          evidenceList.push(trackerEv);

          const confidence = evaluateConfidence({
            reliability: "AUTHORITATIVE",
            evidenceCount: 1,
            isCryptographicOrDirect: true,
          });

          const finding = createUnifiedFinding({
            userId,
            category: "PRIVACY",
            subcategory: "EMAIL_TRACKING",
            title: `Email telemetry detected from ${cleanDomain}`,
            description: `Identified ${detection.trackingPixels.length} tracking pixel(s) and ${detection.redirectUrls.length} telemetry redirect(s)${detection.marketingPlatform ? ` via ${detection.marketingPlatform}` : ""}.`,
            source: "email_privacy_inspector",
            sourceReference: detection.messageId,
            eventAt: inp.timestamp,
            confidence,
            severity: detection.severity,
            evidence: [trackerEv],
            payload: {
              category: "PRIVACY",
              serviceName: inp.serviceName,
              domain: cleanDomain,
              hasTrackingPixel: true,
            },
          });
          findings.push(finding);
        }
      }

      // C. OAuth Application Detection
      const oauthApp = OAuthPermissionAnalyzer.detectFromNotification({
        domain: cleanDomain,
        subject: inp.subject,
        snippet: inp.bodySnippetOrHtml,
        observedAt: inp.timestamp,
      });

      if (oauthApp) {
        oauthApps.push(oauthApp);
        const confidence = evaluateConfidence({
          reliability: "AUTHORITATIVE",
          evidenceCount: 1,
        });

        const finding = createUnifiedFinding({
          userId,
          category: "PRIVACY",
          subcategory: "OAUTH_PERMISSIONS",
          title: `Third-Party OAuth access: ${oauthApp.appName}`,
          description: `Authorization notice on ${oauthApp.provider} for application "${oauthApp.appName}".`,
          source: "oauth_analyzer",
          sourceReference: oauthApp.id,
          eventAt: inp.timestamp,
          confidence,
          severity: oauthApp.riskRating === "CRITICAL" ? "CRITICAL" : "MEDIUM",
          recommendedActions: [PrivacyRecommendations.forOAuthApp(oauthApp)],
          payload: {
            category: "PRIVACY",
            serviceName: oauthApp.appName,
            domain: cleanDomain,
          },
        });
        findings.push(finding);
      }

      // D. Account Cleanup Record
      const accountRecord = CleanupStateMachine.createAccountRecord({
        userId,
        domain: cleanDomain,
        serviceName: inp.serviceName,
        daysInactive: inp.daysInactive ?? 0,
        lastActivityDate: inp.timestamp,
      });
      cleanupAccounts.push(accountRecord);

      const cleanupEv = PrivacyEvidenceBuilder.buildCleanupEvidence(userId, accountRecord);
      evidenceList.push(cleanupEv);

      // Finding for inactive accounts
      if ((inp.daysInactive ?? 0) >= 180) {
        const confidence = evaluateConfidence({
          reliability: "RELIABLE",
          evidenceCount: 1,
        });

        const finding = createUnifiedFinding({
          userId,
          category: "PRIVACY",
          subcategory: "ACCOUNT_CLEANUP",
          title: `Dormant digital account on ${inp.serviceName}`,
          description: `No recorded activity for ${inp.daysInactive} days on ${cleanDomain}. Deletion difficulty: ${accountRecord.deletionDifficulty}.`,
          source: "account_cleanup_tracker",
          sourceReference: accountRecord.id,
          confidence,
          severity: (inp.daysInactive ?? 0) > 365 ? "MEDIUM" : "LOW",
          evidence: [cleanupEv],
          recommendedActions: [PrivacyRecommendations.forCleanupAccount(accountRecord)],
          payload: {
            category: "PRIVACY",
            serviceName: inp.serviceName,
            domain: cleanDomain,
            daysSinceLastActivity: inp.daysInactive,
            deletionDifficulty: accountRecord.deletionDifficulty,
            legalNoticeEligible: true,
          },
        });
        findings.push(finding);
      }
    }

    // 2. Data Broker Matching (Strict Epistemic Honesty)
    const matchedBrokers = BrokerMatcher.matchBrokers(Array.from(discoveredDomains));
    const dataBrokers: DataBrokerRecord[] = matchedBrokers.map((m) => m.broker);

    for (const match of matchedBrokers) {
      const broker = match.broker;
      const confidence = evaluateConfidence({
        reliability: match.isDirectDomainMatch ? "RELIABLE" : "MODERATE",
        evidenceCount: match.isDirectDomainMatch ? 2 : 1,
      });

      const finding = createUnifiedFinding({
        userId,
        category: "PRIVACY",
        subcategory: "DATA_BROKER",
        title: `Data Broker Exposure Risk: ${broker.name}`,
        description: match.reasonForInclusion,
        source: "data_broker_registry",
        sourceReference: broker.id,
        confidence,
        severity: broker.category === "PEOPLE_SEARCH" ? "MEDIUM" : "LOW",
        recommendedActions: [PrivacyRecommendations.forDataBroker(broker)],
        payload: {
          category: "PRIVACY",
          serviceName: broker.name,
          domain: new URL(broker.website).hostname.replace(/^www\./, ""),
          deletionDifficulty: broker.deletionDifficulty,
          legalNoticeEligible: true,
        },
      });
      findings.push(finding);
    }

    // 3. Process Legal Requests
    const updatedLegalRequests: LegalErasureTrackedRequest[] = [];
    for (const req of existingLegalRequests) {
      const deadlineInfo = LegalDeadlineCalculator.calculateDeadlines(req);
      const updatedReq: LegalErasureTrackedRequest = {
        ...req,
        status: deadlineInfo.status,
      };
      updatedLegalRequests.push(updatedReq);

      const reqEv = PrivacyEvidenceBuilder.buildLegalRequestEvidence(userId, updatedReq);
      evidenceList.push(reqEv);

      const confidence = evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: 1,
        isUserVerified: true,
      });

      const finding = createUnifiedFinding({
        userId,
        category: "PRIVACY",
        subcategory: "LEGAL_ERASURE",
        title: `Statutory Erasure Request: ${req.serviceName} (${req.regulation})`,
        description: `Request status: ${updatedReq.status}. Days remaining: ${deadlineInfo.daysRemaining}. Deadline: ${deadlineInfo.effectiveDeadlineDate.slice(0, 10)}.`,
        source: "legal_erasure_tracker",
        sourceReference: req.id,
        confidence,
        severity: deadlineInfo.isOverdue ? "HIGH" : "LOW",
        evidence: [reqEv],
        payload: {
          category: "PRIVACY",
          serviceName: req.serviceName,
          domain: req.targetDomain,
          legalNoticeEligible: true,
        },
      });
      findings.push(finding);
    }

    // 4. Construct Graph Entities & Relationships
    const rootUserEntity = createIntelligenceEntity({
      userId,
      type: "EMAIL_IDENTITY",
      primaryValue: userId,
      displayName: "User Digital Identity",
      attributes: { totalDomains: discoveredDomains.size },
      confidence: evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: 1,
        isUserVerified: true,
      }),
    });
    entities.push(rootUserEntity);

    for (const acc of cleanupAccounts) {
      const accEntity = createIntelligenceEntity({
        userId,
        type: "PLATFORM_ACCOUNT",
        primaryValue: acc.domain,
        displayName: acc.serviceName,
        attributes: {
          deletionDifficulty: acc.deletionDifficulty,
          status: acc.status,
          daysInactive: acc.daysInactive,
        },
        confidence: evaluateConfidence({
          reliability: "RELIABLE",
          evidenceCount: 1,
        }),
      });
      entities.push(accEntity);

      const rel = createIntelligenceRelationship({
        userId,
        sourceEntityId: rootUserEntity.id,
        targetEntityId: accEntity.id,
        type: "ASSOCIATED_WITH",
        source: "account_cleanup_tracker",
        confidence: accEntity.confidence,
      });
      relationships.push(rel);
    }

    // 5. Calculate Privacy Summary & Health Score
    const totalMarketingSenders = unsubscribeCandidates.length;
    const rfc8058EligibleCount = unsubscribeCandidates.filter(
      (c) => c.mechanism === "RFC_8058_POST"
    ).length;
    const unsubscribedCount = cleanupAccounts.filter(
      (c) => c.status === "UNSUBSCRIBED"
    ).length;
    const totalTrackersDetected = trackerDetections.reduce(
      (sum, d) => sum + d.trackingPixels.length,
      0
    );
    const activeLegalRequestsCount = updatedLegalRequests.filter(
      (r) => r.status !== "COMPLETED"
    ).length;
    const overdueLegalRequestsCount = updatedLegalRequests.filter(
      (r) => r.status === "OVERDUE"
    ).length;
    const discoveredAccountsCount = cleanupAccounts.length;
    const deletedAccountsCount = cleanupAccounts.filter(
      (c) => c.status === "DELETION_CONFIRMED"
    ).length;
    const potentialDataBrokersCount = dataBrokers.length;

    // Health Score calculation (0 - 100)
    // Starts at 100, penalties for dormant accounts, trackers, and unhandled mailing lists
    let score = 100;
    score -= Math.min(25, totalMarketingSenders * 2);
    score -= Math.min(20, totalTrackersDetected * 3);
    score -= Math.min(20, cleanupAccounts.filter((a) => a.daysInactive > 180).length * 4);
    score -= Math.min(15, oauthApps.filter((o) => o.riskRating === "CRITICAL").length * 10);
    score -= overdueLegalRequestsCount * 10;
    const privacyHealthScore = Math.max(10, Math.min(100, Math.round(score)));

    const summary: PrivacyIntelligenceSummary = {
      totalMarketingSenders,
      rfc8058EligibleCount,
      unsubscribedCount,
      totalTrackersDetected,
      activeLegalRequestsCount,
      overdueLegalRequestsCount,
      discoveredAccountsCount,
      deletedAccountsCount,
      potentialDataBrokersCount,
      privacyHealthScore,
    };

    return {
      findings,
      entities,
      relationships,
      evidence: evidenceList,
      unsubscribeCandidates,
      trackerDetections,
      oauthApps,
      dataBrokers,
      cleanupAccounts,
      legalRequests: updatedLegalRequests,
      summary,
    };
  }

  private emptyResult(): PrivacyAnalysisResult {
    return {
      findings: [],
      entities: [],
      relationships: [],
      evidence: [],
      unsubscribeCandidates: [],
      trackerDetections: [],
      oauthApps: [],
      dataBrokers: [],
      cleanupAccounts: [],
      legalRequests: [],
      summary: {
        totalMarketingSenders: 0,
        rfc8058EligibleCount: 0,
        unsubscribedCount: 0,
        totalTrackersDetected: 0,
        activeLegalRequestsCount: 0,
        overdueLegalRequestsCount: 0,
        discoveredAccountsCount: 0,
        deletedAccountsCount: 0,
        potentialDataBrokersCount: 0,
        privacyHealthScore: 100,
      },
    };
  }
}

export const defaultPrivacyEngine = new PrivacyEngine();
