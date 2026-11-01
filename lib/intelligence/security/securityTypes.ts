import { type VerificationStatus } from "../core/confidence";
import { type FindingSeverity } from "../core/finding";

export type SecurityEventCategory =
  | "AUTHENTICATION"
  | "CREDENTIAL_CHANGE"
  | "MFA"
  | "DEVELOPER"
  | "ACCOUNT_LEVEL"
  | "BREACH";

export type SecurityEventType =
  | "BREACH_EXPOSURE"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGED"
  | "NEW_LOGIN_DETECTED"
  | "UNFAMILIAR_DEVICE_LOGIN"
  | "FAILED_LOGIN_WARNING"
  | "ACCOUNT_RECOVERY_ATTEMPT"
  | "MFA_MODIFIED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "API_KEY_CREATED"
  | "API_TOKEN_REVOKED"
  | "OAUTH_APP_AUTHORIZED"
  | "SSH_KEY_ADDED"
  | "PERMISSION_CHANGED"
  | "ACCOUNT_SUSPENDED"
  | "SECURITY_VERIFICATION_REQUIRED"
  | "RECOVERY_INFO_CHANGED"
  | "SUSPICIOUS_ACTIVITY";

export type SecurityActionStatus = "ATTEMPTED" | "COMPLETED" | "BLOCKED" | "UNKNOWN";

export interface SecurityEvent {
  id: string;
  userId: string;
  serviceName: string;
  sourceDomain: string;
  category: SecurityEventCategory;
  eventType: SecurityEventType;
  observedAt: string;          // Email message header timestamp (ISO 8601)
  eventTimestamp?: string;      // Explicit incident timestamp from subject/body if distinct
  reportedIp?: string;
  reportedDevice?: string;
  reportedBrowser?: string;
  reportedLocation?: string;
  isLocationEstimated: boolean; // True if inferred from IP (never guaranteed accurate)
  actionStatus: SecurityActionStatus;
  confidence: number;
  severity: FindingSeverity;
  verificationStatus: VerificationStatus;
  evidenceSnippet?: string;
  remediationUrl?: string;
  recommendedActionTitle: string;
  recommendedActionDescription: string;
  messageId?: string;
}

export interface BreachCorrelationResult {
  breachName: string;
  affectedDomain: string;
  breachDate?: string;
  exposedDataClasses: string[];
  historicalDaysAgo?: number;
  subsequentSecurityEvents: SecurityEvent[];
  isRemediationConfirmed: boolean;
  remediationConfirmedAt?: string;
  isCurrentCompromiseLikely: boolean; // Never assumed purely from historical breach
  riskExplanation: string;
}

export interface EmergencyLockdownStep {
  id: string;
  serviceName: string;
  domain: string;
  category: "PRIMARY_EMAIL" | "FINANCIAL" | "CLOUD_STORAGE" | "DEVELOPER" | "SOCIAL" | "OTHER";
  criticalityTier: 1 | 2 | 3 | 4 | 5 | 6; // 1 = highest priority (Primary Email)
  recommendedActions: string[];
  officialSecurityUrl?: string;
  isPasswordChanged: boolean;
  isMfaChecked: boolean;
  isSessionsRevoked: boolean;
  isOAuthReviewed: boolean;
  userNotes?: string;
  completedAt?: string;
}

export interface SecurityIntelligenceSummary {
  totalSecurityEvents: number;
  breachesDetected: number;
  unverifiedEventsCount: number;
  criticalLockdownItemsCount: number;
  timelineDistribution: Record<SecurityEventCategory, number>;
  severityDistribution: Record<FindingSeverity, number>;
  deviceBreakdown: Array<{ device: string; count: number }>;
  browserBreakdown: Array<{ browser: string; count: number }>;
  ipBreakdown: Array<{ ip: string; approximateLocation?: string; count: number }>;
}
