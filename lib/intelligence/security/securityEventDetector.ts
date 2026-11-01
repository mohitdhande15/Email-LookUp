import { DeviceEventAnalyzer } from "./deviceEventAnalyzer";
import { LoginEventAnalyzer } from "./loginEventAnalyzer";
import { PasswordEventDetector } from "./passwordEventDetector";
import { MfaEventDetector } from "./mfaEventDetector";
import { RecoveryEventDetector } from "./recoveryEventDetector";
import { ApiKeyEventDetector } from "./apiKeyEventDetector";
import { SecurityRecommendations } from "./securityRecommendations";
import { MerchantNormalizer } from "../financial/merchantNormalizer";
import {
  type SecurityEvent,
  type SecurityEventCategory,
  type SecurityEventType,
  type SecurityActionStatus,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";
import { type VerificationStatus } from "../core/confidence";

export interface RawEmailSecurityInput {
  messageId: string;
  senderDomain: string;
  senderDisplayName?: string;
  subject: string;
  dateStr: string;
  snippet?: string;
}

export class SecurityEventDetector {
  /**
   * Evaluates an email candidate against all security detectors.
   * Returns a structured SecurityEvent or null if the message is not a security event.
   */
  static detect(
    userId: string,
    input: RawEmailSecurityInput
  ): SecurityEvent | null {
    const norm = MerchantNormalizer.normalize(
      input.senderDomain,
      input.senderDisplayName
    );
    const serviceName = norm.canonicalName;
    const sourceDomain = norm.canonicalDomain;

    const subject = input.subject;
    const snippet = input.snippet || "";
    const fullText = `${subject} ${snippet}`;

    // 1. Check MFA Events
    const mfaRes = MfaEventDetector.analyze(subject, snippet);
    if (mfaRes.isMfaEvent) {
      return this.buildEvent({
        userId,
        serviceName,
        sourceDomain,
        category: "MFA",
        eventType: mfaRes.eventType,
        actionStatus: mfaRes.actionStatus,
        severity: mfaRes.severity,
        title: mfaRes.title,
        description: mfaRes.description,
        input,
        fullText,
      });
    }

    // 2. Check Recovery Changes
    const recoveryRes = RecoveryEventDetector.analyze(subject, snippet);
    if (recoveryRes.isRecoveryEvent) {
      return this.buildEvent({
        userId,
        serviceName,
        sourceDomain,
        category: "CREDENTIAL_CHANGE",
        eventType: recoveryRes.eventType,
        actionStatus: recoveryRes.actionStatus,
        severity: recoveryRes.severity,
        title: recoveryRes.title,
        description: recoveryRes.description,
        input,
        fullText,
      });
    }

    // 3. Check Password Changes / Resets
    const passRes = PasswordEventDetector.analyze(subject, snippet);
    if (passRes.isPasswordEvent) {
      return this.buildEvent({
        userId,
        serviceName,
        sourceDomain,
        category: "CREDENTIAL_CHANGE",
        eventType: passRes.eventType,
        actionStatus: passRes.actionStatus,
        severity: passRes.severity,
        title: passRes.title,
        description: passRes.description,
        input,
        fullText,
      });
    }

    // 4. Check Developer / Account-Level Events
    const devRes = ApiKeyEventDetector.analyze(subject, snippet);
    if (devRes.isDeveloperOrAccountEvent) {
      const category: SecurityEventCategory =
        devRes.eventType === "ACCOUNT_SUSPENDED" || devRes.eventType === "SECURITY_VERIFICATION_REQUIRED"
          ? "ACCOUNT_LEVEL"
          : "DEVELOPER";

      return this.buildEvent({
        userId,
        serviceName,
        sourceDomain,
        category,
        eventType: devRes.eventType,
        actionStatus: devRes.actionStatus,
        severity: devRes.severity,
        title: devRes.title,
        description: devRes.description,
        input,
        fullText,
      });
    }

    // 5. Check Login / Authentication Events
    const loginRes = LoginEventAnalyzer.analyze(subject, snippet);
    if (loginRes.isLoginEvent) {
      return this.buildEvent({
        userId,
        serviceName,
        sourceDomain,
        category: "AUTHENTICATION",
        eventType: loginRes.eventType,
        actionStatus: loginRes.actionStatus,
        severity: loginRes.severity,
        title: loginRes.title,
        description: loginRes.description,
        input,
        fullText,
      });
    }

    // Not a security incident
    return null;
  }

  private static buildEvent(params: {
    userId: string;
    serviceName: string;
    sourceDomain: string;
    category: SecurityEventCategory;
    eventType: SecurityEventType;
    actionStatus: SecurityActionStatus;
    severity: FindingSeverity;
    title: string;
    description: string;
    input: RawEmailSecurityInput;
    fullText: string;
  }): SecurityEvent {
    const {
      userId,
      serviceName,
      sourceDomain,
      category,
      eventType,
      actionStatus,
      severity,
      title,
      description,
      input,
      fullText,
    } = params;

    const deviceMeta = DeviceEventAnalyzer.extractAll(fullText);

    let parsedObservedDate = new Date().toISOString();
    try {
      const d = new Date(input.dateStr);
      if (!isNaN(d.getTime())) parsedObservedDate = d.toISOString();
    } catch {
      // ignore
    }

    const remediationUrl = SecurityRecommendations.getOfficialSecurityUrl(sourceDomain, serviceName);

    let confidence = 0.90;
    let verificationStatus: VerificationStatus = "CONFIRMED_FACT";

    if (actionStatus === "ATTEMPTED" || eventType === "SUSPICIOUS_ACTIVITY") {
      confidence = 0.80;
      verificationStatus = "HIGH_INFERENCE";
    }

    return {
      id: `sec_ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      serviceName,
      sourceDomain,
      category,
      eventType,
      observedAt: parsedObservedDate,
      eventTimestamp: deviceMeta.explicitEventTimestamp || parsedObservedDate,
      reportedIp: deviceMeta.reportedIp,
      reportedDevice: deviceMeta.reportedDevice,
      reportedBrowser: deviceMeta.reportedBrowser,
      reportedLocation: deviceMeta.reportedLocation,
      isLocationEstimated: deviceMeta.isLocationEstimated,
      actionStatus,
      confidence,
      severity,
      verificationStatus,
      evidenceSnippet: input.snippet || input.subject,
      remediationUrl,
      recommendedActionTitle: title,
      recommendedActionDescription: description,
      messageId: input.messageId,
    };
  }
}
