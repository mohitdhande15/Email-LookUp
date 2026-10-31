export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
  recommendedAction: string;
  breachStatus: "unmitigated" | "mitigated" | "none";
}

const SENSITIVE_CATEGORY_RE =
  /(bank|finance|paypal|payment|wallet|credit|shop|store|ebay|amazon|airbnb|uber|food|health|insurance|tax)/i;

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
}): RiskAssessment {
  let breachStatus: RiskAssessment["breachStatus"] = "none";
  if (input.type === "newsletter") {
    return {
      score: 8,
      level: "low",
      reasons: ["Newsletter or bulk sender, not classified as an account"],
      recommendedAction: "Unsubscribe if you no longer want these messages",
      breachStatus,
    };
  }

  let score = input.type === "account" ? 20 : 12;
  const reasons: string[] = [];
  let breachAction: string | null = null;

  if (input.daysAgo >= 365) {
    score += 30;
    reasons.push("No activity email detected for more than one year");
  } else if (input.daysAgo >= 90) {
    score += 18;
    reasons.push("No activity email detected for more than 90 days");
  }

  if (input.statusBasis === "any") {
    score += 4;
    reasons.push("Recency is based on a general email, not a detected activity email");
  }

  if (input.signupLike) {
    score += 8;
    reasons.push("An account creation or security email was detected");
  }

  if (SENSITIVE_CATEGORY_RE.test(`${input.displayName} ${input.domain}`)) {
    score += 20;
    reasons.push("May contain sensitive identity or transaction data");
  }

  if (input.emailCount <= 2) {
    score += 5;
    reasons.push("Only a small amount of mailbox evidence was found");
  }

  const breachDate = input.breachInfo?.breachDate;
  const breachTimestamp = breachDate ? new Date(breachDate).getTime() : NaN;
  const securityTimestamp = input.lastSecurityEmailDate
    ? new Date(input.lastSecurityEmailDate).getTime()
    : NaN;

  if (input.breachInfo?.breached && Number.isFinite(breachTimestamp)) {
    if (!Number.isFinite(securityTimestamp) || securityTimestamp < breachTimestamp) {
      score += 25;
      breachStatus = "unmitigated";
      reasons.push(
        `Critical: Domain appeared in a known breach (${input.breachInfo.breachName || "Historical"}), with no password reset or security email detected after ${breachDate}.`
      );
      breachAction = "Rotate password immediately and revoke active sessions before deleting account.";
    } else {
      score += 5;
      breachStatus = "mitigated";
      reasons.push(
        `Domain was in a historical breach (${breachDate}), but security/password activity was detected afterward (${input.lastSecurityEmailDate}).`
      );
    }
  }

  const boundedScore = Math.min(100, score);
  const level: RiskLevel = boundedScore >= 60 ? "high" : boundedScore >= 35 ? "medium" : "low";

  return {
    score: boundedScore,
    level,
    reasons: reasons.length > 0 ? reasons : ["No strong risk signal found in mailbox headers"],
    recommendedAction: breachAction ?? (
      level === "high"
        ? "Review the account, change its password, enable MFA, or delete it if unused"
        : level === "medium"
          ? "Confirm whether you still use this account and review its security settings"
          : "Keep it under review; mailbox activity alone shows limited risk"),
    breachStatus,
  };
}
