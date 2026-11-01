import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryFindingRepository,
  InMemoryEntityRepository,
  InMemoryEvidenceRepository,
} from "@/lib/intelligence/repositories/inMemoryRepository";
import { createUnifiedFinding } from "@/lib/intelligence/core/finding";
import { createIntelligenceEntity } from "@/lib/intelligence/core/entity";
import { createEvidenceItem } from "@/lib/intelligence/core/evidence";
import { evaluateConfidence } from "@/lib/intelligence/core/confidence";

describe("Repository Layer & User Data Isolation", () => {
  let findingRepo: InMemoryFindingRepository;
  let entityRepo: InMemoryEntityRepository;
  let evidenceRepo: InMemoryEvidenceRepository;

  const conf = evaluateConfidence({
    reliability: "AUTHORITATIVE",
    evidenceCount: 1,
    isCryptographicOrDirect: true,
  });

  beforeEach(() => {
    findingRepo = new InMemoryFindingRepository();
    entityRepo = new InMemoryEntityRepository();
    evidenceRepo = new InMemoryEvidenceRepository();
  });

  it("strictly isolates findings by userId", async () => {
    const findingA = createUnifiedFinding({
      id: "fnd_a1",
      userId: "user_alpha",
      category: "SECURITY",
      subcategory: "BREACH",
      title: "Alpha breach",
      description: "Desc",
      source: "breach",
      confidence: conf,
      severity: "HIGH",
      payload: {
        category: "SECURITY",
        serviceName: "AlphaService",
        eventType: "BREACH_EXPOSURE",
      },
    });

    const findingB = createUnifiedFinding({
      id: "fnd_b1",
      userId: "user_beta",
      category: "FINANCIAL",
      subcategory: "SUBSCRIPTION",
      title: "Beta sub",
      description: "Desc",
      source: "invoice",
      confidence: conf,
      severity: "LOW",
      payload: {
        category: "FINANCIAL",
        merchantName: "BetaService",
      },
    });

    await findingRepo.save(findingA);
    await findingRepo.save(findingB);

    // User Alpha should only see Alpha's findings
    const alphaList = await findingRepo.listByUser("user_alpha");
    expect(alphaList).toHaveLength(1);
    expect(alphaList[0].id).toBe("fnd_a1");

    // User Beta should only see Beta's findings
    const betaList = await findingRepo.listByUser("user_beta");
    expect(betaList).toHaveLength(1);
    expect(betaList[0].id).toBe("fnd_b1");

    // Cross-user lookup returns null
    const crossAccess = await findingRepo.findById("user_alpha", "fnd_b1");
    expect(crossAccess).toBeNull();
  });

  it("filters findings by category and supports pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await findingRepo.save(
        createUnifiedFinding({
          id: `fnd_id_${i}`,
          userId: "user_alpha",
          category: "IDENTITY",
          subcategory: "PROFILE",
          title: `Profile ${i}`,
          description: "Desc",
          source: "web",
          confidence: conf,
          severity: "INFO",
          payload: { category: "IDENTITY", email: "test@example.com" },
        })
      );
    }

    const paged = await findingRepo.findByCategory("user_alpha", "IDENTITY", {
      offset: 2,
      limit: 2,
    });
    expect(paged).toHaveLength(2);
    expect(paged[0].id).toBe("fnd_id_2");
  });

  it("isolates entities and provides lookup by primary value", async () => {
    const entity = createIntelligenceEntity({
      userId: "user_alpha",
      type: "DOMAIN",
      primaryValue: "stripe.com",
      displayName: "Stripe",
      confidence: conf,
    });

    await entityRepo.save(entity);

    const found = await entityRepo.findByPrimaryValue(
      "user_alpha",
      "DOMAIN",
      "stripe.com"
    );
    expect(found).not.toBeNull();
    expect(found?.displayName).toBe("Stripe");

    // Another user cannot find user_alpha's entity
    const crossFound = await entityRepo.findByPrimaryValue(
      "user_beta",
      "DOMAIN",
      "stripe.com"
    );
    expect(crossFound).toBeNull();
  });

  it("indexes evidence by fingerprint for deduplication", async () => {
    const ev = createEvidenceItem({
      userId: "user_alpha",
      source: "gmail",
      type: "MAILBOX_HEADER",
      reliability: "AUTHORITATIVE",
      summary: "Header",
      rawPayloadToFingerprint: "fingerprint_target_1",
    });

    await evidenceRepo.save(ev);

    const match = await evidenceRepo.findByFingerprint(
      "user_alpha",
      ev.provenance.fingerprint
    );
    expect(match).not.toBeNull();
    expect(match?.id).toBe(ev.id);
  });
});
