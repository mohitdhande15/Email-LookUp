import { type VerificationStatus } from "../core/confidence";
import { type FindingSeverity } from "../core/finding";

export type CurrencyCode =
  | "INR"
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CAD"
  | "AUD"
  | "SGD"
  | "OTHER"
  | "UNKNOWN";

export type BillingFrequency =
  | "MONTHLY"
  | "ANNUAL"
  | "QUARTERLY"
  | "WEEKLY"
  | "ONE_OFF"
  | "UNKNOWN";

export type SubscriptionCategory =
  | "SAAS"
  | "STREAMING"
  | "CLOUD_STORAGE"
  | "SOFTWARE_LICENSE"
  | "MEMBERSHIP"
  | "NEWSLETTER"
  | "SERVICES"
  | "UNKNOWN";

export type PaymentStatus =
  | "CONFIRMED_PAID"
  | "PENDING"
  | "REFUNDED"
  | "FAILED"
  | "INVOICED_ONLY";

export type FinancialDocumentType =
  | "PAYMENT_RECEIPT"
  | "INVOICE"
  | "ORDER_CONFIRMATION"
  | "RENEWAL_NOTICE"
  | "TRIAL_CONFIRMATION"
  | "TRIAL_CANCELLATION"
  | "PRICE_UPDATE_NOTICE"
  | "ACCOUNT_STATEMENT"
  | "UNKNOWN";

export interface MonetaryAmount {
  amount: number;
  currency: CurrencyCode;
  rawString: string;
}

export interface ExtractedTransaction {
  id: string;
  merchantName: string;
  senderDomain: string;
  emailSubject: string;
  transactionDate: string; // ISO 8601
  amount?: number;
  currency?: CurrencyCode;
  documentType: FinancialDocumentType;
  paymentStatus: PaymentStatus;
  taxAmount?: number;
  invoiceNumber?: string;
  billingFrequency?: BillingFrequency;
  renewalDate?: string;
  isTrialEvent?: boolean;
  trialExpiresAt?: string;
  cancellationUrl?: string;
  evidenceSnippet?: string;
  rawMessageId?: string;
}

export interface SubscriptionRecord {
  id: string;
  merchantName: string;
  canonicalDomain: string;
  category: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  currency: CurrencyCode;
  lastAmount: number;
  estimatedMonthlyCost: number;
  estimatedAnnualCost: number;
  firstDetectedDate: string;
  lastDetectedDate: string;
  nextRenewalDate?: string;
  transactionCount: number;
  confidence: number;
  verificationStatus: VerificationStatus;
  severity: FindingSeverity;
  evidenceIds: string[];
  cancellationUrl?: string;
}

export interface TrialRecord {
  id: string;
  serviceName: string;
  canonicalDomain: string;
  trialStartDate: string;
  trialExpirationDate: string; // ISO 8601
  daysRemaining: number;
  expectedPostTrialAmount?: number;
  currency?: CurrencyCode;
  cancellationUrl?: string;
  cancellationGuide?: string;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED";
  confidence: number;
  verificationStatus: VerificationStatus;
  evidenceIds: string[];
}

export interface PriceChangeEvent {
  id: string;
  merchantName: string;
  canonicalDomain: string;
  currency: CurrencyCode;
  previousAmount: number;
  newAmount: number;
  absoluteChange: number;
  percentageChange: number;
  effectiveDate: string;
  billingFrequency: BillingFrequency;
  isAmbiguous: boolean;
  ambiguityReason?: string;
  confidence: number;
  evidenceIds: string[];
}

export interface MerchantSpendingSummary {
  merchantName: string;
  canonicalDomain: string;
  category: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  currency: CurrencyCode;
  monthlyCost: number;
  annualCost: number;
  transactionCount: number;
}

export interface FinancialSummary {
  estimatedMonthlyRecurringCost: number;
  estimatedAnnualRecurringCost: number;
  totalActiveSubscriptions: number;
  activeTrialsCount: number;
  priceHikeAlertsCount: number;
  primaryCurrency: CurrencyCode;
  spendingByMerchant: MerchantSpendingSummary[];
  spendingByCurrency: Record<string, number>;
  spendingByCategory: Record<string, number>;
  billingFrequencyDistribution: Record<BillingFrequency, number>;
  historicalSpendingTrend: Array<{
    month: string; // YYYY-MM
    total: number;
    currency: CurrencyCode;
  }>;
}
