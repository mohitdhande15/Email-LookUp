import { createHash } from "node:crypto";
import { type SourceReliability } from "./confidence";

export type EvidenceType =
  | "MAILBOX_HEADER"       // Gmail/RFC 822 metadata header (From, Subject, Date, List-Unsubscribe)
  | "OSINT_RECORD"         // Public database lookup (XposedOrNot, HIBP, Gravatar)
  | "PUBLIC_PROFILE"       // Public developer/social profile (GitHub API, etc.)
  | "DNS_SECURITY_RECORD"  // SPF, DKIM, DMARC, MX records
  | "AUTHENTICATION_LOG"   // OAuth grant, token refresh or security event log
  | "USER_INPUT";          // Directly submitted or confirmed by user

export interface EvidenceProvenance {
  sourceUrl?: string;
  endpoint?: string;
  httpStatus?: number;
  retrievedAt: string;
  fingerprint: string;     // SHA-256 hash of canonical evidence representation for deduplication
}

export interface EvidenceItem {
  id: string;
  findingId?: string;
  userId: string;
  source: string;          // e.g. "gmail_header", "github_api", "xposedornot_api"
  type: EvidenceType;
  reliability: SourceReliability;
  observedAt: string;      // ISO-8601
  summary: string;         // Human-readable summary of the evidence
  /**
   * Sanitized, minimal snippet required to substantiate the finding.
   * NEVER store raw mailbox message bodies or unredacted passwords.
   */
  sanitizedSnippet?: string;
  provenance: EvidenceProvenance;
  metadata?: Record<string, unknown>;
}

/**
 * Computes a deterministic SHA-256 fingerprint for deduplication.
 */
export function generateEvidenceFingerprint(
  source: string,
  type: EvidenceType,
  uniquePayload: string
): string {
  return createHash("sha256")
    .update(`${source.trim().toLowerCase()}:${type}:${uniquePayload.trim()}`)
    .digest("hex");
}

/**
 * Factory to construct a validated, deduplicable EvidenceItem.
 */
export function createEvidenceItem(params: {
  userId: string;
  findingId?: string;
  source: string;
  type: EvidenceType;
  reliability: SourceReliability;
  summary: string;
  rawPayloadToFingerprint: string;
  sanitizedSnippet?: string;
  sourceUrl?: string;
  endpoint?: string;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
}): EvidenceItem {
  const now = new Date().toISOString();
  const fingerprint = generateEvidenceFingerprint(
    params.source,
    params.type,
    params.rawPayloadToFingerprint
  );
  const id = `ev_${fingerprint.slice(0, 16)}`;

  return {
    id,
    findingId: params.findingId,
    userId: params.userId,
    source: params.source,
    type: params.type,
    reliability: params.reliability,
    observedAt: now,
    summary: params.summary,
    sanitizedSnippet: params.sanitizedSnippet,
    provenance: {
      sourceUrl: params.sourceUrl,
      endpoint: params.endpoint,
      httpStatus: params.httpStatus,
      retrievedAt: now,
      fingerprint,
    },
    metadata: params.metadata,
  };
}
