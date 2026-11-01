import { type ConfidenceAssessment } from "./confidence";
import { type EvidenceItem } from "./evidence";

export type FindingCategory = "IDENTITY" | "FINANCIAL" | "SECURITY" | "PRIVACY";

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ActionType =
  | "ROTATE_CREDENTIALS"
  | "REVOKE_SESSION"
  | "ENABLE_MFA"
  | "DELETE_ACCOUNT"
  | "LEGAL_ERASURE_REQUEST"
  | "CANCEL_SUBSCRIPTION"
  | "UNSUBSCRIBE_BULK"
  | "REVIEW_PERMISSIONS"
  | "VERIFY_REMEDIATION"
  | "INFORMATIONAL";

export interface FindingAction {
  id: string;
  type: ActionType;
  label: string;
  description: string;
  actionUrl?: string;
  isCompleted?: boolean;
  priority: "IMMEDIATE" | "RECOMMENDED" | "OPTIONAL";
}

// ── Discriminated Category Payloads ─────────────────────────────────

export interface IdentityFindingPayload {
  category: "IDENTITY";
  email: string;
  associatedProfileUrl?: string;
  platformName?: string;
  username?: string;
  avatarUrl?: string;
  organization?: string;
  bioSnippet?: string;
  publicRepoCount?: number;
}

export interface FinancialFindingPayload {
  category: "FINANCIAL";
  merchantName: string;
  estimatedAmount?: number;
  currency?: string;
  billingFrequency?: "MONTHLY" | "ANNUAL" | "QUARTERLY" | "WEEKLY" | "ONE_OFF" | "UNKNOWN";
  lastBilledDate?: string;
  renewalDate?: string;
  trialExpirationDate?: string;
  isFreeTrial?: boolean;
  isPriceIncreaseAlert?: boolean;
  priceDeltaPercentage?: number;
}

export interface SecurityFindingPayload {
  category: "SECURITY";
  serviceName: string;
  eventType:
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
  eventDate?: string;
  compromisedDataClasses?: string[];
  breachName?: string;
  isRemediationConfirmedByUser?: boolean;
  ipAddress?: string;
  device?: string;
  browser?: string;
  location?: string;
  isLocationEstimated?: boolean;
  remediationUrl?: string;
  actionStatus?: "ATTEMPTED" | "COMPLETED" | "BLOCKED" | "UNKNOWN";
}

export interface PrivacyFindingPayload {
  category: "PRIVACY";
  serviceName: string;
  domain: string;
  daysSinceLastActivity?: number;
  isMarketingList?: boolean;
  unsubscribeUrl?: string;
  rfc8058Compliant?: boolean;
  hasTrackingPixel?: boolean;
  deletionDifficulty?: "EASY" | "MODERATE" | "DIFFICULT" | "UNKNOWN";
  legalNoticeEligible?: boolean;
}

export type FindingPayload =
  | IdentityFindingPayload
  | FinancialFindingPayload
  | SecurityFindingPayload
  | PrivacyFindingPayload;

// ── Main Unified Finding Model ──────────────────────────────────────

export interface UnifiedFinding {
  id: string;
  userId: string;
  category: FindingCategory;
  subcategory: string;
  title: string;
  description: string;
  source: string;
  sourceReference?: string;
  observedAt: string;        // ISO-8601
  eventAt?: string;           // ISO-8601
  confidence: ConfidenceAssessment;
  severity: FindingSeverity;
  evidence: EvidenceItem[];
  relatedEntityIds: string[];
  recommendedActions: FindingAction[];
  payload: FindingPayload;
  metadata?: Record<string, unknown>;
}

export function createUnifiedFinding(params: {
  id?: string;
  userId: string;
  category: FindingCategory;
  subcategory: string;
  title: string;
  description: string;
  source: string;
  sourceReference?: string;
  eventAt?: string;
  confidence: ConfidenceAssessment;
  severity: FindingSeverity;
  evidence?: EvidenceItem[];
  relatedEntityIds?: string[];
  recommendedActions?: FindingAction[];
  payload: FindingPayload;
  metadata?: Record<string, unknown>;
}): UnifiedFinding {
  const id =
    params.id ??
    `fnd_${params.category.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    userId: params.userId,
    category: params.category,
    subcategory: params.subcategory,
    title: params.title,
    description: params.description,
    source: params.source,
    sourceReference: params.sourceReference,
    observedAt: new Date().toISOString(),
    eventAt: params.eventAt,
    confidence: params.confidence,
    severity: params.severity,
    evidence: params.evidence ?? [],
    relatedEntityIds: params.relatedEntityIds ?? [],
    recommendedActions: params.recommendedActions ?? [],
    payload: params.payload,
    metadata: params.metadata,
  };
}
