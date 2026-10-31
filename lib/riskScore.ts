export type RiskLevel = "low" | "medium" | "high";

export type BreachStatus =
  | "unmitigated"
  | "unverified_remediation"
  | "mitigated"
  | "none";

export interface RiskFactor {
  id: string;
  category: "breach" | "inactivity" | "sensitivity" | "evidence" | "recency";
  description: string;
  scoreContribution: number;
  confidence: "high" | "medium" | "low";
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
  factors?: RiskFactor[];
  recommendedAction: string;
  breachStatus: BreachStatus;
}

const SENSITIVE_CATEGORY_RE =
  /(bank|finance|paypal|payment|wallet|credit|shop|store|ebay|amazon|airbnb|uber|food|health|insurance|tax|crypto|binance|coinbase|fidelity|vanguard|chase|citi|wells|barclays|hsbc)/i;

export function assessPlatformRisk(input: {
  displayName: string;
  domain: string;
  type: "account" | "newsletter" | "unknown";
  daysAgo: number;
  statusBasis: "activity" | "any";
  emailCount: number;
  signupLike: boolean;
  breachInfo?: { breached: boolean; breachName?: string; breachDate?: string };
  lastSecurityEmailDate?: string | null;
  userVerifiedRemediation?: boolean;
}): RiskAssessment {
  let breachStatus: BreachStatus = "none";

  if (input.type === "newsletter") {
    return {
      score: 8,
      level: "low",
      reasons: ["Newsletter or bulk sender, not classified as an interactive account"],
      recommendedAction: "Unsubscribe if you no longer want these messages",
      breachStatus,
    };
  }

  let score = input.type === "account" ? 20 : 12;
  const reasons: string[] = [];
  const factors: RiskFactor[] = [];
  let breachAction: string | null = null;

  // 1. Inactivity assessment
  if (input.daysAgo >= 365) {
    score += 30;
    reasons.push("Dormant account: No activity email detected for more than one year");
    factors.push({
      id: "dormancy_1y",
      category: "inactivity",
      description: "Dormant for over 365 days",
      scoreContribution: 30,
      confidence: "high",
    });
  } else if (input.daysAgo >= 90) {
    score += 18;
    reasons.push("Inactive account: No activity email detected for more than 90 days");
    factors.push({
      id: "inactivity_90d",
      category: "inactivity",
      description: "Inactive for over 90 days",
      scoreContribution: 18,
      confidence: "high",
    });
  }

  // 2. Status basis confidence
  if (input.statusBasis === "any") {
    score += 4;
    reasons.push("Recency is based on a general notification, not a confirmed activity email");
    factors.push({
      id: "general_recency_basis",
      category: "evidence",
      description: "Recency estimated from general notification",
      scoreContribution: 4,
      confidence: "medium",
    });
  }

  // 3. Signup / verification evidence
  if (input.signupLike) {
    score += 8;
    reasons.push("Account creation, activation, or security email was confirmed in headers");
    factors.push({
      id: "account_confirmed",
      category: "evidence",
      description: "Account creation or security headers found",
      scoreContribution: 8,
      confidence: "high",
    });
  }

  // 4. Data sensitivity
  if (SENSITIVE_CATEGORY_RE.test(`${input.displayName} ${input.domain}`)) {
    score += 20;
    reasons.push("High-sensitivity platform: Likely processes financial, healthcare, or personal identity transactions");
    factors.push({
      id: "high_sensitivity_platform",
      category: "sensitivity",
      description: "Financial, commerce, or identity sensitivity",
      scoreContribution: 20,
      confidence: "high",
    });
  }

  // 5. Sparse evidence note
  if (input.emailCount <= 2) {
    score += 5;
    reasons.push("Sparse mailbox history: Only 1-2 communications found in scan");
    factors.push({
      id: "sparse_evidence",
      category: "evidence",
      description: "Sparse mailbox communication",
      scoreContribution: 5,
      confidence: "medium",
    });
  }

  // 6. Breach correlation & remediation assessment
  const breachDate = input.breachInfo?.breachDate;
  const breachTimestamp = breachDate ? new Date(breachDate).getTime() : NaN;
  const securityTimestamp = input.lastSecurityEmailDate
    ? new Date(input.lastSecurityEmailDate).getTime()
    : NaN;

  if (input.breachInfo?.breached && Number.isFinite(breachTimestamp)) {
    if (input.userVerifiedRemediation) {
      breachStatus = "mitigated";
      reasons.push(
        `User verified: Password rotated and MFA configured following historical breach (${input.breachInfo.breachName || breachDate}).`
      );
      factors.push({
        id: "breach_verified_mitigated",
        category: "breach",
        description: "User verified remediation completed",
        scoreContribution: 0,
        confidence: "high",
      });
    } else if (Number.isFinite(securityTimestamp) && securityTimestamp >= breachTimestamp) {
      // Security email detected AFTER breach date, but NOT verified
      score += 12;
      breachStatus = "unverified_remediation";
      reasons.push(
        `Domain appeared in historical breach (${input.breachInfo.breachName || breachDate}). Potential remediation signal: Security activity detected on ${input.lastSecurityEmailDate}, but password rotation and 2FA status are unverified.`
      );
      breachAction = `Confirm credential rotation on ${input.displayName} and verify that multi-factor authentication (MFA) is enabled.`;
      factors.push({
        id: "breach_unverified_signal",
        category: "breach",
        description: "Security email detected post-breach, verification pending",
        scoreContribution: 12,
        confidence: "medium",
      });
    } else {
      // No security activity after breach date
      score += 25;
      breachStatus = "unmitigated";
      reasons.push(
        `Critical: Domain appeared in known breach (${input.breachInfo.breachName || breachDate}), with no password reset or security activity detected in mailbox afterward.`
      );
      breachAction = `Rotate password immediately on ${input.displayName}, revoke active sessions, and check for credential reuse across other services.`;
      factors.push({
        id: "breach_unmitigated",
        category: "breach",
        description: "Unmitigated breach exposure detected",
        scoreContribution: 25,
        confidence: "high",
      });
    }
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const level: RiskLevel = boundedScore >= 60 ? "high" : boundedScore >= 35 ? "medium" : "low";

  return {
    score: boundedScore,
    level,
    reasons: reasons.length > 0 ? reasons : ["No elevated risk signals identified in mailbox headers"],
    factors,
    recommendedAction: breachAction ?? (
      level === "high"
        ? "Review the account, change its password, enable MFA, or delete it if unused"
        : level === "medium"
          ? "Confirm whether you still use this account and review its security settings"
          : "Keep under periodic review; mailbox activity indicates standard low risk"
    ),
    breachStatus,
  };
}
