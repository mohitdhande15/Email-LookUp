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
import { type BreachEntry } from "../../sources/breach";
import { SecurityEventDetector, type RawEmailSecurityInput } from "./securityEventDetector";
import { BreachCorrelationEngine } from "./breachCorrelation";
import { SecurityEvidenceBuilder } from "./securityEvidence";
import { SecurityRecommendations } from "./securityRecommendations";
import {
  type SecurityEvent,
  type BreachCorrelationResult,
  type EmergencyLockdownStep,
  type SecurityIntelligenceSummary,
  type SecurityEventCategory,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";

export interface SecurityEventInput {
  userId: string;
  sourceDomain: string;
  serviceName: string;
  subject: string;
  timestamp: string;
  snippet?: string;
  messageId?: string;
}

export interface SecurityAnalysisResult {
  findings: UnifiedFinding[];
  entities: IntelligenceEntity[];
  relationships: IntelligenceRelationship[];
  evidence: EvidenceItem[];
  events: SecurityEvent[];
  breachCorrelations: BreachCorrelationResult[];
  lockdownSteps: EmergencyLockdownStep[];
  summary: SecurityIntelligenceSummary;
}

export interface ISecurityEngine {
  analyzeSecurityFootprint(
    userId: string,
    rawInputs: RawEmailSecurityInput[],
    breaches?: BreachEntry[],
    userMitigatedBreachNames?: Set<string>
  ): Promise<SecurityAnalysisResult>;
  processSecurityEvents(
    inputs: SecurityEventInput[]
  ): Promise<SecurityAnalysisResult>;
}

export class SecurityEngine implements ISecurityEngine {
  /**
   * Main entrypoint: Processes security candidate emails, extracts structured security events,
   * correlates with breach intelligence, builds emergency lockdown workflows, and produces
   * unified findings, entities, and relationships.
   */
  async analyzeSecurityFootprint(
    userId: string,
    rawInputs: RawEmailSecurityInput[],
    breaches: BreachEntry[] = [],
    userMitigatedBreachNames: Set<string> = new Set()
  ): Promise<SecurityAnalysisResult> {
    // 1. Detect security events from mailbox inputs
    const detectedEvents: SecurityEvent[] = [];
    for (const input of rawInputs) {
      const event = SecurityEventDetector.detect(userId, input);
      if (event) {
        detectedEvents.push(event);
      }
    }

    // Sort events newest first
    detectedEvents.sort(
      (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
    );

    // 2. Correlate with breach intelligence
    const breachCorrelations = BreachCorrelationEngine.correlateBreaches(
      breaches,
      detectedEvents,
      userMitigatedBreachNames
    );

    // 3. Build Evidence items (zero raw email bodies stored)
    const evidenceItems: EvidenceItem[] = detectedEvents.map((ev) =>
      SecurityEvidenceBuilder.buildSecurityEventEvidence(userId, ev)
    );

    // 4. Construct Root User Entity
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

    // 5. Convert Security Events to Unified Findings & Graph Nodes
    for (const ev of detectedEvents) {
      const evConfidence = evaluateConfidence({
        reliability: "AUTHORITATIVE",
        evidenceCount: 1,
        isCryptographicOrDirect: ev.verificationStatus === "CONFIRMED_FACT",
      });

      const eventEntity = createIntelligenceEntity({
        userId,
        type: ev.eventType === "OAUTH_APP_AUTHORIZED" ? "OAUTH_APPLICATION" : "SECURITY_EVENT",
        primaryValue: `${ev.serviceName}:${ev.eventType}`,
        displayName: `${ev.serviceName} ${ev.recommendedActionTitle}`,
        confidence: evConfidence,
        attributes: {
          category: ev.category,
          eventType: ev.eventType,
          actionStatus: ev.actionStatus,
          observedAt: ev.observedAt,
          eventTimestamp: ev.eventTimestamp,
          reportedIp: ev.reportedIp,
          reportedDevice: ev.reportedDevice,
          reportedBrowser: ev.reportedBrowser,
          reportedLocation: ev.reportedLocation,
          isLocationEstimated: ev.isLocationEstimated,
        },
      });
      entities.push(eventEntity);

      const eventRelationship = createIntelligenceRelationship({
        userId,
        sourceEntityId: rootUserEntity.id,
        targetEntityId: eventEntity.id,
        type: ev.eventType === "NEW_LOGIN_DETECTED" || ev.eventType === "UNFAMILIAR_DEVICE_LOGIN"
          ? "AUTHENTICATED_WITH"
          : "RELATED_TO",
        source: "security_event_engine",
        evidenceIds: [ev.id],
        confidence: evConfidence,
      });
      relationships.push(eventRelationship);

      const actions = [
        {
          id: `act_sec_${ev.id}`,
          type: ev.eventType === "PASSWORD_CHANGED" || ev.eventType === "PASSWORD_RESET"
            ? ("ROTATE_CREDENTIALS" as const)
            : ev.eventType === "MFA_DISABLED"
            ? ("ENABLE_MFA" as const)
            : ev.eventType === "UNFAMILIAR_DEVICE_LOGIN" || ev.eventType === "SUSPICIOUS_ACTIVITY"
            ? ("REVOKE_SESSION" as const)
            : ("REVIEW_PERMISSIONS" as const),
          label: ev.recommendedActionTitle,
          description: ev.recommendedActionDescription,
          actionUrl: ev.remediationUrl,
          priority: ev.severity === "CRITICAL"
            ? ("IMMEDIATE" as const)
            : ev.severity === "HIGH"
            ? ("RECOMMENDED" as const)
            : ("OPTIONAL" as const),
        },
      ];

      const finding = createUnifiedFinding({
        userId,
        category: "SECURITY",
        subcategory: ev.category,
        title: `${ev.serviceName}: ${ev.recommendedActionTitle}`,
        description: `${ev.recommendedActionDescription}${ev.reportedDevice ? ` Observed device: ${ev.reportedDevice}.` : ""}${ev.reportedIp ? ` Reported IP: ${ev.reportedIp}.` : ""}`,
        source: "security_event_detector",
        sourceReference: ev.sourceDomain,
        eventAt: ev.eventTimestamp || ev.observedAt,
        confidence: evConfidence,
        severity: ev.severity,
        evidence: evidenceItems.filter((e) => e.metadata?.eventType === ev.eventType),
        relatedEntityIds: [rootUserEntity.id, eventEntity.id],
        recommendedActions: actions,
        payload: {
          category: "SECURITY",
          serviceName: ev.serviceName,
          eventType: ev.eventType,
          eventDate: ev.eventTimestamp || ev.observedAt,
          ipAddress: ev.reportedIp,
          device: ev.reportedDevice,
          browser: ev.reportedBrowser,
          location: ev.reportedLocation,
          isLocationEstimated: ev.isLocationEstimated,
          remediationUrl: ev.remediationUrl,
          actionStatus: ev.actionStatus,
        },
      });
      findings.push(finding);
    }

    // 6. Convert Breach Correlations to Unified Findings & Graph Nodes
    for (const b of breachCorrelations) {
      const breachConfidence = evaluateConfidence({
        reliability: "RELIABLE",
        evidenceCount: b.exposedDataClasses.length,
      });

      const breachEntity = createIntelligenceEntity({
        userId,
        type: "DATA_BREACH",
        primaryValue: b.breachName,
        displayName: `${b.breachName} Data Breach`,
        confidence: breachConfidence,
        attributes: {
          domain: b.affectedDomain,
          breachDate: b.breachDate,
          exposedDataClasses: b.exposedDataClasses,
          isRemediationConfirmed: b.isRemediationConfirmed,
          historicalDaysAgo: b.historicalDaysAgo,
        },
      });
      entities.push(breachEntity);

      const breachRel = createIntelligenceRelationship({
        userId,
        sourceEntityId: rootUserEntity.id,
        targetEntityId: breachEntity.id,
        type: "EXPOSED_IN",
        source: "xposedornot_breach_intelligence",
        evidenceIds: [],
        confidence: breachConfidence,
      });
      relationships.push(breachRel);

      const actions = [
        {
          id: `act_brch_${b.breachName.replace(/[^a-z0-9]/gi, "_")}`,
          type: "ROTATE_CREDENTIALS" as const,
          label: `Rotate Password on ${b.breachName}`,
          description: b.riskExplanation,
          actionUrl: SecurityRecommendations.getOfficialSecurityUrl(b.affectedDomain, b.breachName),
          priority: b.isCurrentCompromiseLikely ? ("IMMEDIATE" as const) : ("RECOMMENDED" as const),
        },
      ];

      const finding = createUnifiedFinding({
        userId,
        category: "SECURITY",
        subcategory: "BREACH_EXPOSURE",
        title: `Breach Exposure: ${b.breachName}`,
        description: b.riskExplanation,
        source: "breach_correlation_engine",
        sourceReference: b.affectedDomain,
        eventAt: b.breachDate,
        confidence: breachConfidence,
        severity: b.isCurrentCompromiseLikely ? "CRITICAL" : b.isRemediationConfirmed ? "LOW" : "HIGH",
        evidence: evidenceItems,
        relatedEntityIds: [rootUserEntity.id, breachEntity.id],
        recommendedActions: actions,
        payload: {
          category: "SECURITY",
          serviceName: b.breachName,
          eventType: "BREACH_EXPOSURE",
          eventDate: b.breachDate,
          compromisedDataClasses: b.exposedDataClasses,
          breachName: b.breachName,
          isRemediationConfirmedByUser: b.isRemediationConfirmed,
          remediationUrl: SecurityRecommendations.getOfficialSecurityUrl(b.affectedDomain, b.breachName),
        },
      });
      findings.push(finding);
    }

    // 7. Generate Emergency Lockdown Steps (Ordered by Criticality Tier)
    const lockdownSteps = this.generateLockdownSteps(detectedEvents, breachCorrelations);

    // 8. Generate Security Intelligence Summary
    const summary = this.generateSummary(detectedEvents, breachCorrelations, lockdownSteps);

    return {
      findings,
      entities,
      relationships,
      evidence: evidenceItems,
      events: detectedEvents,
      breachCorrelations,
      lockdownSteps,
      summary,
    };
  }

  /**
   * Generates prioritized emergency lockdown checklist items sorted by service criticality.
   */
  private generateLockdownSteps(
    events: SecurityEvent[],
    breaches: BreachCorrelationResult[]
  ): EmergencyLockdownStep[] {
    const serviceMap = new Map<string, { serviceName: string; domain: string }>();

    for (const ev of events) {
      if (!serviceMap.has(ev.serviceName)) {
        serviceMap.set(ev.serviceName, { serviceName: ev.serviceName, domain: ev.sourceDomain });
      }
    }

    for (const br of breaches) {
      if (!serviceMap.has(br.breachName)) {
        serviceMap.set(br.breachName, { serviceName: br.breachName, domain: br.affectedDomain });
      }
    }

    const steps: EmergencyLockdownStep[] = [];

    for (const { serviceName, domain } of serviceMap.values()) {
      let category: EmergencyLockdownStep["category"] = "OTHER";
      let tier: EmergencyLockdownStep["criticalityTier"] = 6;

      const lowerDomain = domain.toLowerCase();
      const lowerName = serviceName.toLowerCase();

      if (lowerDomain.includes("google") || lowerDomain.includes("gmail") || lowerDomain.includes("proton") || lowerDomain.includes("outlook")) {
        category = "PRIMARY_EMAIL";
        tier = 1;
      } else if (lowerDomain.includes("stripe") || lowerDomain.includes("paypal") || lowerDomain.includes("bank") || lowerName.includes("pay")) {
        category = "FINANCIAL";
        tier = 2;
      } else if (lowerDomain.includes("dropbox") || lowerDomain.includes("drive") || lowerDomain.includes("icloud")) {
        category = "CLOUD_STORAGE";
        tier = 3;
      } else if (lowerDomain.includes("github") || lowerDomain.includes("aws") || lowerDomain.includes("vercel") || lowerDomain.includes("gitlab")) {
        category = "DEVELOPER";
        tier = 4;
      } else if (lowerDomain.includes("facebook") || lowerDomain.includes("twitter") || lowerDomain.includes("meta") || lowerDomain.includes("x.com")) {
        category = "SOCIAL";
        tier = 5;
      }

      steps.push({
        id: `lockdown_${domain.replace(/[^a-z0-9]/gi, "_")}`,
        serviceName,
        domain,
        category,
        criticalityTier: tier,
        recommendedActions: [
          `1. Rotate master password for ${serviceName}`,
          `2. Enable or re-verify Multi-Factor Authentication (MFA)`,
          `3. Terminate all other active sessions and remembered devices`,
          `4. Review connected third-party OAuth applications`,
        ],
        officialSecurityUrl: SecurityRecommendations.getOfficialSecurityUrl(domain, serviceName),
        isPasswordChanged: false,
        isMfaChecked: false,
        isSessionsRevoked: false,
        isOAuthReviewed: false,
      });
    }

    // Sort by criticality tier ascending (1 = Primary Email first)
    return steps.sort((a, b) => a.criticalityTier - b.criticalityTier);
  }

  /**
   * Compiles the high-level security intelligence summary.
   */
  private generateSummary(
    events: SecurityEvent[],
    breaches: BreachCorrelationResult[],
    lockdownSteps: EmergencyLockdownStep[]
  ): SecurityIntelligenceSummary {
    const timelineDist: Record<SecurityEventCategory, number> = {
      AUTHENTICATION: 0,
      CREDENTIAL_CHANGE: 0,
      MFA: 0,
      DEVELOPER: 0,
      ACCOUNT_LEVEL: 0,
      BREACH: breaches.length,
    };

    const severityDist: Record<FindingSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const ipMap = new Map<string, { count: number; loc?: string }>();

    for (const ev of events) {
      timelineDist[ev.category] = (timelineDist[ev.category] || 0) + 1;
      severityDist[ev.severity] = (severityDist[ev.severity] || 0) + 1;

      if (ev.reportedDevice) {
        deviceMap.set(ev.reportedDevice, (deviceMap.get(ev.reportedDevice) || 0) + 1);
      }
      if (ev.reportedBrowser) {
        browserMap.set(ev.reportedBrowser, (browserMap.get(ev.reportedBrowser) || 0) + 1);
      }
      if (ev.reportedIp) {
        const cur = ipMap.get(ev.reportedIp) || { count: 0, loc: ev.reportedLocation };
        cur.count++;
        ipMap.set(ev.reportedIp, cur);
      }
    }

    for (const br of breaches) {
      if (br.isCurrentCompromiseLikely) severityDist.CRITICAL++;
      else if (!br.isRemediationConfirmed) severityDist.HIGH++;
      else severityDist.LOW++;
    }

    return {
      totalSecurityEvents: events.length,
      breachesDetected: breaches.length,
      unverifiedEventsCount: events.filter((e) => e.verificationStatus === "HIGH_INFERENCE").length,
      criticalLockdownItemsCount: lockdownSteps.filter((s) => s.criticalityTier <= 2).length,
      timelineDistribution: timelineDist,
      severityDistribution: severityDist,
      deviceBreakdown: Array.from(deviceMap.entries()).map(([device, count]) => ({ device, count })),
      browserBreakdown: Array.from(browserMap.entries()).map(([browser, count]) => ({ browser, count })),
      ipBreakdown: Array.from(ipMap.entries()).map(([ip, meta]) => ({
        ip,
        approximateLocation: meta.loc,
        count: meta.count,
      })),
    };
  }

  /**
   * Compatibility adapter for ISecurityEngine metadata inputs.
   */
  async processSecurityEvents(
    inputs: SecurityEventInput[]
  ): Promise<SecurityAnalysisResult> {
    if (!inputs.length) {
      return this.analyzeSecurityFootprint("user_default", []);
    }

    const userId = inputs[0].userId;
    const rawInputs: RawEmailSecurityInput[] = inputs.map((inp, idx) => ({
      messageId: inp.messageId || `msg_sec_${idx}`,
      senderDomain: inp.sourceDomain,
      senderDisplayName: inp.serviceName,
      subject: inp.subject,
      dateStr: inp.timestamp,
      snippet: inp.snippet,
    }));

    return this.analyzeSecurityFootprint(userId, rawInputs);
  }
}

export const defaultSecurityEngine = new SecurityEngine();
