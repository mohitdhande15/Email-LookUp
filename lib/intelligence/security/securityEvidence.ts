import {
  createEvidenceItem,
  type EvidenceItem,
} from "../core/evidence";
import { type SecurityEvent } from "./securityTypes";

export class SecurityEvidenceBuilder {
  /**
   * Constructs an authenticated EvidenceItem from a security event.
   * Enforces zero-raw-message-body storage: only records sanitized metadata and headers.
   */
  static buildSecurityEventEvidence(
    userId: string,
    event: SecurityEvent
  ): EvidenceItem {
    const summary = `${event.eventType} alert on ${event.serviceName} observed on ${event.observedAt.slice(0, 10)}${event.reportedDevice ? ` via ${event.reportedDevice}` : ""}${event.reportedIp ? ` (IP: ${event.reportedIp})` : ""}`;

    const canonicalPayload = `${event.serviceName}:${event.sourceDomain}:${event.eventType}:${event.observedAt}:${event.reportedIp || ""}:${event.actionStatus}`;

    return createEvidenceItem({
      userId,
      source: "gmail_security_metadata",
      type: "MAILBOX_HEADER",
      reliability: "AUTHORITATIVE",
      summary,
      rawPayloadToFingerprint: canonicalPayload,
      sanitizedSnippet: event.evidenceSnippet,
      metadata: {
        serviceName: event.serviceName,
        sourceDomain: event.sourceDomain,
        eventType: event.eventType,
        actionStatus: event.actionStatus,
        reportedIp: event.reportedIp,
        reportedDevice: event.reportedDevice,
        reportedBrowser: event.reportedBrowser,
        reportedLocation: event.reportedLocation,
        isLocationEstimated: event.isLocationEstimated,
        observedAt: event.observedAt,
        eventTimestamp: event.eventTimestamp,
      },
    });
  }
}
