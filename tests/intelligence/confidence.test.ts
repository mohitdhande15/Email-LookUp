import { describe, it, expect } from "vitest";
import { evaluateConfidence } from "@/lib/intelligence/core/confidence";

describe("Confidence Engine & Epistemic Honesty", () => {
  it("marks user-verified items with score 1.00 and isConfirmed=true", () => {
    const res = evaluateConfidence({
      reliability: "AUTHORITATIVE",
      evidenceCount: 1,
      isUserVerified: true,
    });

    expect(res.score).toBe(1.0);
    expect(res.status).toBe("VERIFIED_USER");
    expect(res.isConfirmed).toBe(true);
  });

  it("marks direct cryptographic/API proof as CONFIRMED_FACT with isConfirmed=true", () => {
    const res = evaluateConfidence({
      reliability: "AUTHORITATIVE",
      evidenceCount: 1,
      isCryptographicOrDirect: true,
    });

    expect(res.score).toBeGreaterThanOrEqual(0.95);
    expect(res.status).toBe("CONFIRMED_FACT");
    expect(res.isConfirmed).toBe(true);
  });

  it("classifies multi-source reliable data as HIGH_INFERENCE without claiming fact", () => {
    const res = evaluateConfidence({
      reliability: "RELIABLE",
      evidenceCount: 3, // multiple corroborating evidence items
    });

    expect(res.score).toBeGreaterThanOrEqual(0.75);
    expect(res.status).toBe("HIGH_INFERENCE");
    expect(res.isConfirmed).toBe(false); // Inferences are never confirmed facts
  });

  it("classifies single-source moderate evidence as LOW_INFERENCE", () => {
    const res = evaluateConfidence({
      reliability: "MODERATE",
      evidenceCount: 1,
    });

    expect(res.status).toBe("LOW_INFERENCE");
    expect(res.isConfirmed).toBe(false);
  });

  it("classifies anonymous or uncorroborated evidence as UNVERIFIED", () => {
    const res = evaluateConfidence({
      reliability: "UNVERIFIED",
      evidenceCount: 1,
    });

    expect(res.status).toBe("UNVERIFIED");
    expect(res.score).toBeLessThanOrEqual(0.35);
    expect(res.isConfirmed).toBe(false);
  });

  it("significantly reduces confidence when conflicting signals exist", () => {
    const withoutConflict = evaluateConfidence({
      reliability: "RELIABLE",
      evidenceCount: 2,
    });

    const withConflict = evaluateConfidence({
      reliability: "RELIABLE",
      evidenceCount: 2,
      hasConflictingSignals: true,
    });

    expect(withConflict.score).toBeLessThan(withoutConflict.score);
  });
});
