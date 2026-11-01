import { z } from "zod";

// ── Confidence & Verification Schemas ───────────────────────────────

export const VerificationStatusSchema = z.enum([
  "CONFIRMED_FACT",
  "VERIFIED_USER",
  "HIGH_INFERENCE",
  "LOW_INFERENCE",
  "UNVERIFIED",
]);

export const SourceReliabilitySchema = z.enum([
  "AUTHORITATIVE",
  "RELIABLE",
  "MODERATE",
  "UNVERIFIED",
]);

export const ConfidenceAssessmentSchema = z.object({
  score: z.number().min(0).max(1),
  status: VerificationStatusSchema,
  reliability: SourceReliabilitySchema,
  explanation: z.string().min(1),
  evidenceCount: z.number().int().nonnegative(),
  isConfirmed: z.boolean(),
});

// ── Evidence Schemas ────────────────────────────────────────────────

export const EvidenceTypeSchema = z.enum([
  "MAILBOX_HEADER",
  "OSINT_RECORD",
  "PUBLIC_PROFILE",
  "DNS_SECURITY_RECORD",
  "AUTHENTICATION_LOG",
  "USER_INPUT",
]);

export const EvidenceProvenanceSchema = z.object({
  sourceUrl: z.string().optional(),
  endpoint: z.string().optional(),
  httpStatus: z.number().int().optional(),
  retrievedAt: z.string().datetime({ offset: true }).or(z.string()),
  fingerprint: z.string().min(8),
});

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  findingId: z.string().optional(),
  userId: z.string().min(1),
  source: z.string().min(1),
  type: EvidenceTypeSchema,
  reliability: SourceReliabilitySchema,
  observedAt: z.string().datetime({ offset: true }).or(z.string()),
  summary: z.string().min(1),
  sanitizedSnippet: z.string().optional(),
  provenance: EvidenceProvenanceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Finding Action Schemas ──────────────────────────────────────────

export const ActionTypeSchema = z.enum([
  "ROTATE_CREDENTIALS",
  "REVOKE_SESSION",
  "ENABLE_MFA",
  "DELETE_ACCOUNT",
  "LEGAL_ERASURE_REQUEST",
  "CANCEL_SUBSCRIPTION",
  "UNSUBSCRIBE_BULK",
  "REVIEW_PERMISSIONS",
  "VERIFY_REMEDIATION",
  "INFORMATIONAL",
]);

export const FindingActionSchema = z.object({
  id: z.string().min(1),
  type: ActionTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  actionUrl: z.string().optional(),
  isCompleted: z.boolean().optional(),
  priority: z.enum(["IMMEDIATE", "RECOMMENDED", "OPTIONAL"]),
});

// ── Discriminated Finding Payloads ──────────────────────────────────

export const IdentityFindingPayloadSchema = z.object({
  category: z.literal("IDENTITY"),
  email: z.string().email(),
  associatedProfileUrl: z.string().optional(),
  platformName: z.string().optional(),
  username: z.string().optional(),
  avatarUrl: z.string().optional(),
  organization: z.string().optional(),
  bioSnippet: z.string().optional(),
  publicRepoCount: z.number().int().optional(),
});

export const FinancialFindingPayloadSchema = z.object({
  category: z.literal("FINANCIAL"),
  merchantName: z.string().min(1),
  estimatedAmount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  billingFrequency: z
    .enum(["MONTHLY", "ANNUAL", "QUARTERLY", "WEEKLY", "ONE_OFF", "UNKNOWN"])
    .optional(),
  lastBilledDate: z.string().optional(),
  renewalDate: z.string().optional(),
  trialExpirationDate: z.string().optional(),
  isFreeTrial: z.boolean().optional(),
  isPriceIncreaseAlert: z.boolean().optional(),
  priceDeltaPercentage: z.number().optional(),
});

export const SecurityFindingPayloadSchema = z.object({
  category: z.literal("SECURITY"),
  serviceName: z.string().min(1),
  eventType: z.enum([
    "BREACH_EXPOSURE",
    "PASSWORD_RESET",
    "PASSWORD_CHANGED",
    "NEW_LOGIN_DETECTED",
    "UNFAMILIAR_DEVICE_LOGIN",
    "FAILED_LOGIN_WARNING",
    "ACCOUNT_RECOVERY_ATTEMPT",
    "MFA_MODIFIED",
    "MFA_ENABLED",
    "MFA_DISABLED",
    "API_KEY_CREATED",
    "API_TOKEN_REVOKED",
    "OAUTH_APP_AUTHORIZED",
    "SSH_KEY_ADDED",
    "PERMISSION_CHANGED",
    "ACCOUNT_SUSPENDED",
    "SECURITY_VERIFICATION_REQUIRED",
    "RECOVERY_INFO_CHANGED",
    "SUSPICIOUS_ACTIVITY",
  ]),
  eventDate: z.string().optional(),
  compromisedDataClasses: z.array(z.string()).optional(),
  breachName: z.string().optional(),
  isRemediationConfirmedByUser: z.boolean().optional(),
  ipAddress: z.string().optional(),
  device: z.string().optional(),
  browser: z.string().optional(),
  location: z.string().optional(),
  isLocationEstimated: z.boolean().optional(),
  remediationUrl: z.string().optional(),
  actionStatus: z.enum(["ATTEMPTED", "COMPLETED", "BLOCKED", "UNKNOWN"]).optional(),
});

export const PrivacyFindingPayloadSchema = z.object({
  category: z.literal("PRIVACY"),
  serviceName: z.string().min(1),
  domain: z.string().min(1),
  daysSinceLastActivity: z.number().int().optional(),
  isMarketingList: z.boolean().optional(),
  unsubscribeUrl: z.string().optional(),
  rfc8058Compliant: z.boolean().optional(),
  hasTrackingPixel: z.boolean().optional(),
  deletionDifficulty: z.enum(["EASY", "MODERATE", "DIFFICULT", "UNKNOWN"]).optional(),
  legalNoticeEligible: z.boolean().optional(),
});

export const FindingPayloadSchema = z.discriminatedUnion("category", [
  IdentityFindingPayloadSchema,
  FinancialFindingPayloadSchema,
  SecurityFindingPayloadSchema,
  PrivacyFindingPayloadSchema,
]);

// ── Unified Finding Schema ──────────────────────────────────────────

export const FindingCategorySchema = z.enum([
  "IDENTITY",
  "FINANCIAL",
  "SECURITY",
  "PRIVACY",
]);

export const FindingSeveritySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
]);

export const UnifiedFindingSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  category: FindingCategorySchema,
  subcategory: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  source: z.string().min(1),
  sourceReference: z.string().optional(),
  observedAt: z.string().datetime({ offset: true }).or(z.string()),
  eventAt: z.string().optional(),
  confidence: ConfidenceAssessmentSchema,
  severity: FindingSeveritySchema,
  evidence: z.array(EvidenceItemSchema),
  relatedEntityIds: z.array(z.string()),
  recommendedActions: z.array(FindingActionSchema),
  payload: FindingPayloadSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Entity & Relationship Schemas ───────────────────────────────────

export const EntityTypeSchema = z.enum([
  "EMAIL_IDENTITY",
  "PERSON_PROFILE",
  "ORGANIZATION",
  "DOMAIN",
  "PLATFORM_ACCOUNT",
  "SUBSCRIPTION",
  "SECURITY_EVENT",
  "DATA_BREACH",
  "OAUTH_APPLICATION",
  "CRYPTOGRAPHIC_IDENTITY",
]);

export const IntelligenceEntitySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: EntityTypeSchema,
  primaryValue: z.string().min(1),
  displayName: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()),
  firstObservedAt: z.string().datetime({ offset: true }).or(z.string()),
  lastObservedAt: z.string().datetime({ offset: true }).or(z.string()),
  confidence: ConfidenceAssessmentSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const RelationshipTypeSchema = z.enum([
  "ASSOCIATED_WITH",
  "DISCOVERED_ON",
  "EXPOSED_IN",
  "SUBSCRIBED_TO",
  "AUTHENTICATED_WITH",
  "RECEIVED_FROM",
  "RELATED_TO",
]);

export const IntelligenceRelationshipSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1),
  type: RelationshipTypeSchema,
  source: z.string().min(1),
  evidenceIds: z.array(z.string()),
  confidence: ConfidenceAssessmentSchema,
  observedAt: z.string().datetime({ offset: true }).or(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
