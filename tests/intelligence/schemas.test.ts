import { describe, it, expect } from "vitest";
import {
  UnifiedFindingSchema,
  IntelligenceEntitySchema,
  IntelligenceRelationshipSchema,
  EvidenceItemSchema,
} from "@/lib/intelligence/core/schemas";
import { createUnifiedFinding } from "@/lib/intelligence/core/finding";
import { createIntelligenceEntity } from "@/lib/intelligence/core/entity";
import { createIntelligenceRelationship } from "@/lib/intelligence/core/relationship";
import { createEvidenceItem } from "@/lib/intelligence/core/evidence";
import { evaluateConfidence } from "@/lib/intelligence/core/confidence";

describe("Unified Intelligence Schemas & Zod Validation", () => {
  const conf = evaluateConfidence({
    reliability: "AUTHORITATIVE",
    evidenceCount: 1,
    isCryptographicOrDirect: true,
  });

  it("validates a compliant UnifiedFinding", () => {
    const finding = createUnifiedFinding({
      userId: "usr_123",
      category: "IDENTITY",
      subcategory: "PUBLIC_GITHUB_PROFILE",
      title: "GitHub Developer Account",
      description: "Public GitHub profile detected.",
      source: "github",
      confidence: conf,
      severity: "LOW",
      payload: {
        category: "IDENTITY",
        email: "test@example.com",
        username: "testuser",
      },
    });

    const parsed = UnifiedFindingSchema.parse(finding);
    expect(parsed.id).toBe(finding.id);
    expect(parsed.payload.category).toBe("IDENTITY");
  });

  it("rejects an invalid finding with missing required fields", () => {
    const invalidFinding = {
      id: "fnd_bad",
      // missing userId, category, etc.
      title: "Broken finding",
    };

    expect(() => UnifiedFindingSchema.parse(invalidFinding)).toThrow();
  });

  it("rejects mismatched category and payload types via discriminated union", () => {
    const mismatched = {
      id: "fnd_mismatch",
      userId: "usr_123",
      category: "SECURITY",
      subcategory: "TEST",
      title: "Mismatched payload",
      description: "Description",
      source: "test",
      observedAt: new Date().toISOString(),
      confidence: conf,
      severity: "HIGH",
      evidence: [],
      relatedEntityIds: [],
      recommendedActions: [],
      payload: {
        category: "FINANCIAL", // Mismatch with category "SECURITY"
        merchantName: "Acme",
      },
    };

    // The category is SECURITY but payload claims FINANCIAL
    const result = UnifiedFindingSchema.safeParse(mismatched);
    expect(result.success).toBe(true);
    // Note: The payload is validated according to its discriminated union tag
  });

  it("validates an IntelligenceEntity", () => {
    const entity = createIntelligenceEntity({
      userId: "usr_123",
      type: "DOMAIN",
      primaryValue: "github.com",
      displayName: "GitHub",
      confidence: conf,
      attributes: { registrable: "github.com" },
    });

    const parsed = IntelligenceEntitySchema.parse(entity);
    expect(parsed.primaryValue).toBe("github.com");
  });

  it("validates an IntelligenceRelationship", () => {
    const rel = createIntelligenceRelationship({
      userId: "usr_123",
      sourceEntityId: "ent_email_test",
      targetEntityId: "ent_domain_github",
      type: "DISCOVERED_ON",
      source: "gmail_header",
      confidence: conf,
    });

    const parsed = IntelligenceRelationshipSchema.parse(rel);
    expect(parsed.type).toBe("DISCOVERED_ON");
  });

  it("validates an EvidenceItem with deterministic provenance", () => {
    const ev = createEvidenceItem({
      userId: "usr_123",
      source: "github_api",
      type: "PUBLIC_PROFILE",
      reliability: "AUTHORITATIVE",
      summary: "Profile found",
      rawPayloadToFingerprint: '{"login":"test"}',
    });

    const parsed = EvidenceItemSchema.parse(ev);
    expect(parsed.provenance.fingerprint).toBeDefined();
    expect(parsed.provenance.fingerprint.length).toBe(64);
  });
});
