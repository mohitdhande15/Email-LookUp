/**
 * Confidence and Verification Engine.
 * 
 * Enforces strict epistemic honesty:
 * 1. CONFIRMED_FACT - Direct cryptographic, authoritative, or authenticated proof.
 * 2. VERIFIED_USER - Explicitly confirmed or verified by the authenticated account owner.
 * 3. HIGH_INFERENCE - Corroborated by multiple independent, reliable evidence items.
 * 4. LOW_INFERENCE - Derived from single-source heuristic or indirect pattern matching.
 * 5. UNVERIFIED - Reported by third-party without corroborating evidence or verification.
 * 
 * Never represent an inference as a verified fact.
 */

export type VerificationStatus =
  | "CONFIRMED_FACT"
  | "VERIFIED_USER"
  | "HIGH_INFERENCE"
  | "LOW_INFERENCE"
  | "UNVERIFIED";

export type SourceReliability =
  | "AUTHORITATIVE"   // Official API, cryptographic signature, DKIM/SPF verified header
  | "RELIABLE"        // Well-maintained public breach DB, structured platform API
  | "MODERATE"        // Generic web scraping, secondary directory, unauthenticated header
  | "UNVERIFIED";     // Anonymous or heuristic guess

export interface ConfidenceAssessment {
  /** Numeric confidence rating from 0.00 (none) to 1.00 (absolute certainty) */
  score: number;
  /** Epistemic classification */
  status: VerificationStatus;
  /** Source reliability tier */
  reliability: SourceReliability;
  /** Human-readable rationale for this confidence level */
  explanation: string;
  /** Number of independent pieces of evidence supporting this */
  evidenceCount: number;
  /** Whether this represents a confirmed fact rather than an inference */
  isConfirmed: boolean;
}

export function evaluateConfidence(params: {
  reliability: SourceReliability;
  evidenceCount: number;
  isCryptographicOrDirect?: boolean;
  isUserVerified?: boolean;
  hasConflictingSignals?: boolean;
}): ConfidenceAssessment {
  const {
    reliability,
    evidenceCount,
    isCryptographicOrDirect = false,
    isUserVerified = false,
    hasConflictingSignals = false,
  } = params;

  if (isUserVerified) {
    return {
      score: 1.0,
      status: "VERIFIED_USER",
      reliability: "AUTHORITATIVE",
      explanation: "Explicitly confirmed and verified by the account owner.",
      evidenceCount: Math.max(1, evidenceCount),
      isConfirmed: true,
    };
  }

  if (isCryptographicOrDirect && reliability === "AUTHORITATIVE") {
    return {
      score: 0.98,
      status: "CONFIRMED_FACT",
      reliability: "AUTHORITATIVE",
      explanation: "Verified through authoritative direct API response or cryptographic proof.",
      evidenceCount: Math.max(1, evidenceCount),
      isConfirmed: true,
    };
  }

  let baseScore: number;
  switch (reliability) {
    case "AUTHORITATIVE":
      baseScore = 0.85;
      break;
    case "RELIABLE":
      baseScore = 0.70;
      break;
    case "MODERATE":
      baseScore = 0.45;
      break;
    case "UNVERIFIED":
    default:
      baseScore = 0.25;
      break;
  }

  // Corroboration adjustment
  const corroborationBonus = Math.min(0.20, (evidenceCount - 1) * 0.08);
  let finalScore = baseScore + Math.max(0, corroborationBonus);

  if (hasConflictingSignals) {
    finalScore = Math.max(0.1, finalScore - 0.35);
  }

  finalScore = Math.min(0.95, Math.max(0.05, finalScore));

  let status: VerificationStatus;
  if (finalScore >= 0.75) {
    status = "HIGH_INFERENCE";
  } else if (finalScore >= 0.40) {
    status = "LOW_INFERENCE";
  } else {
    status = "UNVERIFIED";
  }

  const explanation =
    status === "HIGH_INFERENCE"
      ? `High-confidence inference supported by ${evidenceCount} piece(s) of reliable evidence.`
      : status === "LOW_INFERENCE"
      ? `Preliminary inference based on ${reliability.toLowerCase()} evidence; requires user or secondary corroboration.`
      : `Unverified information; sparse or unconfirmed evidence.`;

  return {
    score: Number(finalScore.toFixed(2)),
    status,
    reliability,
    explanation,
    evidenceCount,
    isConfirmed: false,
  };
}
