import {
  createEvidenceItem,
  type EvidenceItem,
} from "../core/evidence";
import {
  type UnsubscribeCandidate,
  type EmailTrackerDetection,
  type LegalErasureTrackedRequest,
  type CleanupAccountRecord,
} from "./privacyTypes";

export class PrivacyEvidenceBuilder {
  /**
   * Builds an authenticated EvidenceItem for an email unsubscribe header observation.
   */
  static buildUnsubscribeEvidence(
    userId: string,
    candidate: UnsubscribeCandidate
  ): EvidenceItem {
    const summary = `Unsubscribe header (${candidate.mechanism}) detected from ${candidate.senderName} (${candidate.domain})`;
    const canonicalPayload = `unsub:${candidate.domain}:${candidate.senderEmail}:${candidate.mechanism}:${candidate.targetUrl || candidate.mailtoAddress || ""}`;

    return createEvidenceItem({
      userId,
      source: "gmail_header_inspection",
      type: "MAILBOX_HEADER",
      reliability: "AUTHORITATIVE",
      summary,
      rawPayloadToFingerprint: canonicalPayload,
      sanitizedSnippet: candidate.listUnsubscribeHeader
        ? `List-Unsubscribe: ${candidate.listUnsubscribeHeader.slice(0, 150)}`
        : undefined,
      metadata: {
        domain: candidate.domain,
        senderEmail: candidate.senderEmail,
        mechanism: candidate.mechanism,
        frequencyRating: candidate.frequencyRating,
        emailCount: candidate.emailCount,
      },
    });
  }

  /**
   * Builds an authenticated EvidenceItem for tracking pixel / redirect detection.
   * Guarantees zero raw email body retention.
   */
  static buildTrackerEvidence(
    userId: string,
    detection: EmailTrackerDetection
  ): EvidenceItem {
    const pixelCount = detection.trackingPixels.length;
    const redirectCount = detection.redirectUrls.length;
    const summary = `Privacy Telemetry: ${pixelCount} tracking pixel(s) and ${redirectCount} redirect wrapper(s) from ${detection.senderDomain}`;
    const canonicalPayload = `tracker:${detection.senderDomain}:${detection.messageId}:${pixelCount}:${redirectCount}:${detection.receivedAt}`;

    return createEvidenceItem({
      userId,
      source: "email_privacy_inspector",
      type: "MAILBOX_HEADER",
      reliability: "AUTHORITATIVE",
      summary,
      rawPayloadToFingerprint: canonicalPayload,
      metadata: {
        messageId: detection.messageId,
        senderDomain: detection.senderDomain,
        senderEmail: detection.senderEmail,
        marketingPlatform: detection.marketingPlatform,
        pixelCount,
        redirectCount,
        receivedAt: detection.receivedAt,
      },
    });
  }

  /**
   * Builds an EvidenceItem for a legal erasure request.
   */
  static buildLegalRequestEvidence(
    userId: string,
    req: LegalErasureTrackedRequest
  ): EvidenceItem {
    const summary = `Formal erasure request under ${req.regulation} dispatched to ${req.serviceName} (${req.targetDomain})`;
    const canonicalPayload = `legal_erasure:${req.targetDomain}:${req.regulation}:${req.requestDate}:${req.contactEmail}`;

    return createEvidenceItem({
      userId,
      source: "legal_erasure_generator",
      type: "USER_INPUT",
      reliability: "AUTHORITATIVE",
      summary,
      rawPayloadToFingerprint: canonicalPayload,
      metadata: {
        targetDomain: req.targetDomain,
        serviceName: req.serviceName,
        regulation: req.regulation,
        requestDate: req.requestDate,
        initialDeadlineDate: req.initialDeadlineDate,
        contactEmail: req.contactEmail,
        status: req.status,
      },
    });
  }

  /**
   * Builds an EvidenceItem for account cleanup tracking.
   */
  static buildCleanupEvidence(
    userId: string,
    account: CleanupAccountRecord
  ): EvidenceItem {
    const summary = `Account cleanup record for ${account.serviceName} (${account.domain}) - Status: ${account.status} (${account.deletionDifficulty} difficulty)`;
    const canonicalPayload = `cleanup:${account.domain}:${account.status}:${account.daysInactive}`;

    return createEvidenceItem({
      userId,
      source: "account_cleanup_tracker",
      type: "MAILBOX_HEADER",
      reliability: "RELIABLE",
      summary,
      rawPayloadToFingerprint: canonicalPayload,
      metadata: {
        domain: account.domain,
        serviceName: account.serviceName,
        status: account.status,
        deletionDifficulty: account.deletionDifficulty,
        daysInactive: account.daysInactive,
      },
    });
  }
}
