import { type VerificationStatus } from "../core/confidence";
import { type FindingSeverity } from "../core/finding";

// ── Module A: Unsubscribe Types ───────────────────────────────────────

export type UnsubscribeMechanism =
  | "RFC_8058_POST"
  | "MAILTO"
  | "WEB_FORM"
  | "NONE";

export interface UnsubscribeCandidate {
  id: string;
  domain: string;
  senderName: string;
  senderEmail: string;
  listUnsubscribeHeader?: string;
  listUnsubscribePostHeader?: string;
  mechanism: UnsubscribeMechanism;
  targetUrl?: string;
  mailtoAddress?: string;
  mailSubject?: string;
  frequencyRating: "DAILY" | "WEEKLY" | "OCCASIONAL";
  emailCount: number;
  status: "PENDING" | "EXECUTING" | "SUCCESS" | "FAILED" | "MANUAL_REQUIRED";
  lastExecutedAt?: string;
  executionMessage?: string;
}

export interface UnsubscribeExecutionResult {
  candidateId: string;
  success: boolean;
  mechanism: UnsubscribeMechanism;
  message: string;
  httpStatus?: number;
  timestamp: string;
  auditSnippet: string;
}

// ── Module B: OAuth Permission Center Types ───────────────────────────

export type OAuthProviderType =
  | "GOOGLE"
  | "GITHUB"
  | "DISCORD"
  | "MICROSOFT"
  | "APPLE"
  | "GENERIC";

export interface OAuthPermission {
  scope: string;
  friendlyName: string;
  description: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  isSensitive: boolean;
}

export interface OAuthAppRecord {
  id: string;
  provider: OAuthProviderType;
  appName: string;
  clientId?: string;
  scopes: string[];
  riskRating: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  grantedAt?: string;
  managementUrl: string;
  notes?: string;
  discoveredFromDomain?: string;
}

// ── Module C: Data Broker Intelligence Types ──────────────────────────

export type BrokerCategory =
  | "PEOPLE_SEARCH"
  | "FINANCIAL_CREDIT"
  | "MARKETING_ADVERTISING"
  | "RISK_FRAUD"
  | "HEALTH_DATA"
  | "GENERAL";

export type BrokerJurisdiction =
  | "US_CALIFORNIA"
  | "US_VERMONT"
  | "US_GENERAL"
  | "EU_GLOBAL"
  | "GLOBAL";

export type RegistrySource =
  | "CPPA_DROP"
  | "VERMONT_SOS"
  | "DIRECT_VERIFIED";

export type OptOutMethod =
  | "ONLINE_FORM"
  | "EMAIL"
  | "POSTAL"
  | "PORTAL"
  | "AUTOMATED_API";

export type DeletionDifficultyRating =
  | "EASY"
  | "MODERATE"
  | "DIFFICULT"
  | "UNKNOWN";

export type BrokerExposureProbability =
  | "CONFIRMED"
  | "HIGH"
  | "MODERATE"
  | "UNVERIFIED";

export interface DataBrokerRecord {
  id: string;
  name: string;
  website: string;
  category: BrokerCategory;
  jurisdiction: BrokerJurisdiction;
  registrySources: RegistrySource[];
  optOutUrl: string;
  optOutMethod: OptOutMethod;
  deletionDifficulty: DeletionDifficultyRating;
  typicalRetention: string;
  exposureProbability: BrokerExposureProbability;
  californiaDropEligible: boolean;
  instructions: string;
  userOptOutStatus?: "NOT_STARTED" | "IN_PROGRESS" | "OPTED_OUT" | "CONFIRMED";
}

// ── Module D: Legal Erasure Tracker Types ──────────────────────────────

export type LegalRegulation =
  | "GDPR_EU"
  | "UK_GDPR"
  | "CCPA_US"
  | "DPDP_INDIA";

export type LegalRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "EXTENSION_NOTIFIED"
  | "COMPLETED"
  | "OVERDUE"
  | "DISPUTED";

export interface LegalErasureTrackedRequest {
  id: string;
  userId: string;
  targetDomain: string;
  serviceName: string;
  regulation: LegalRegulation;
  requestDate: string;             // ISO-8601
  initialDeadlineDays: number;     // GDPR = 30, CCPA = 45, DPDP = 30
  initialDeadlineDate: string;     // ISO-8601
  isExtensionClaimed: boolean;
  extensionDeadlineDays?: number;  // GDPR +60, CCPA +45
  extensionDeadlineDate?: string;  // ISO-8601
  status: LegalRequestStatus;
  contactEmail: string;
  referenceNumber?: string;
  isStatutoryCommenced: boolean;   // FALSE for India DPDP until May 13, 2027
  statutoryCommencementDate?: string; // "2027-05-13" for DPDP
  notes?: string;
  evidenceId?: string;
}

// ── Module E: Account Cleanup State Machine Types ──────────────────────

export type CleanupAccountStatus =
  | "DISCOVERED"
  | "UNDER_REVIEW"
  | "KEEP_ACCOUNT"
  | "CLEANUP_PLANNED"
  | "UNSUBSCRIBE_PENDING"
  | "UNSUBSCRIBED"
  | "DELETION_REQUESTED"
  | "RESPONSE_RECEIVED"
  | "DELETION_CONFIRMED"
  | "REJECTED"
  | "ACTION_REQUIRED";

export interface CleanupStatusTransition {
  from: CleanupAccountStatus;
  to: CleanupAccountStatus;
  changedAt: string;
  note?: string;
}

export interface CleanupAccountRecord {
  id: string;
  userId: string;
  domain: string;
  serviceName: string;
  status: CleanupAccountStatus;
  deletionDifficulty: DeletionDifficultyRating;
  deleteUrl?: string;
  directDeleteSupported: boolean;
  daysInactive: number;
  lastActivityDate?: string;
  statusHistory: CleanupStatusTransition[];
  notes?: string;
}

// ── Module F: Email Privacy Inspector Types ────────────────────────────

export interface TrackingPixelIndicator {
  trackerName?: string;
  trackerDomain?: string;
  isZeroSize: boolean;
  sourceUrlSnippet?: string;
}

export interface RedirectLinkIndicator {
  redirectDomain: string;
  targetDomain?: string;
  wrapperPattern?: string;
}

export interface EmailTrackerDetection {
  messageId: string;
  senderDomain: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  trackingPixels: TrackingPixelIndicator[];
  redirectUrls: RedirectLinkIndicator[];
  marketingPlatform?: string;
  severity: FindingSeverity;
  verificationStatus: VerificationStatus;
}

// ── Privacy Intelligence Summary & Aggregate ──────────────────────────

export interface PrivacyIntelligenceSummary {
  totalMarketingSenders: number;
  rfc8058EligibleCount: number;
  unsubscribedCount: number;
  totalTrackersDetected: number;
  activeLegalRequestsCount: number;
  overdueLegalRequestsCount: number;
  discoveredAccountsCount: number;
  deletedAccountsCount: number;
  potentialDataBrokersCount: number;
  privacyHealthScore: number; // 0 - 100
}
