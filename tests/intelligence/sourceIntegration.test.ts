import { describe, it, expect } from "vitest";
import { IdentityEngine } from "@/lib/intelligence/identity/identityEngine";
import { type SourceResult } from "@/lib/sources/types";
import {
  UnifiedFindingSchema,
  IntelligenceEntitySchema,
  IntelligenceRelationshipSchema,
  EvidenceItemSchema,
} from "@/lib/intelligence/core/schemas";
import { projectEntityToGraphNode } from "@/lib/intelligence/core/entity";
import { projectRelationshipToGraphEdge } from "@/lib/intelligence/core/relationship";

describe("Source Integration & Graph Projection (End-to-End)", () => {
  const engine = new IdentityEngine();

  const mockSourceResults: SourceResult[] = [
    {
      source: "gravatar",
      status: "found",
      data: {
        name: "Alice Developer",
        avatarUrl: "https://gravatar.com/avatar/123",
        profileUrl: "https://gravatar.com/alice",
        jobTitle: "Security Engineer",
        verifiedAccounts: [{ label: "github", url: "https://github.com/alice" }],
      },
    },
    {
      source: "github",
      status: "found",
      data: {
        login: "alicedev",
        name: "Alice D.",
        profileUrl: "https://github.com/alicedev",
        avatarUrl: "https://avatars.githubusercontent.com/u/1",
        publicRepos: 18,
        followers: 42,
      },
    },
    {
      source: "breach",
      status: "found",
      data: {
        count: 2,
        hasDetails: true,
        breaches: [
          {
            name: "Dropbox",
            date: "2012-07-01",
            industry: "Cloud Storage",
            xposedData: ["Email addresses", "Passwords"],
          },
        ],
      },
    },
  ];

  it("transforms raw OSINT results into validated Unified Findings, Entities, and Evidence", () => {
    const result = engine.processPublicSources(
      "usr_123",
      "alice@example.com",
      mockSourceResults
    );

    expect(result.rootIdentity.primaryValue).toBe("alice@example.com");
    expect(result.entities.length).toBeGreaterThanOrEqual(4); // root, gravatar, github, dropbox
    expect(result.findings.length).toBe(3); // gravatar profile, github profile, dropbox breach
    expect(result.relationships.length).toBe(3);
    expect(result.evidence.length).toBe(3);

    // Verify all findings conform to Zod schema
    for (const f of result.findings) {
      expect(() => UnifiedFindingSchema.parse(f)).not.toThrow();
    }

    // Verify all entities conform to Zod schema
    for (const e of result.entities) {
      expect(() => IntelligenceEntitySchema.parse(e)).not.toThrow();
    }

    // Verify all relationships conform to Zod schema
    for (const r of result.relationships) {
      expect(() => IntelligenceRelationshipSchema.parse(r)).not.toThrow();
    }

    // Verify all evidence items conform to Zod schema
    for (const ev of result.evidence) {
      expect(() => EvidenceItemSchema.parse(ev)).not.toThrow();
    }
  });

  it("projects entities and relationships to Graph Nodes and Edges for Three.js visualization", () => {
    const result = engine.processPublicSources(
      "usr_123",
      "alice@example.com",
      mockSourceResults
    );

    const nodes = result.entities.map(projectEntityToGraphNode);
    const edges = result.relationships.map(projectRelationshipToGraphEdge);

    expect(nodes).toHaveLength(result.entities.length);
    expect(edges).toHaveLength(result.relationships.length);

    // Root email is category PRIMARY
    const rootNode = nodes.find((n) => n.id === result.rootIdentity.id);
    expect(rootNode?.category).toBe("PRIMARY");

    // Breach is category THREAT and has CRITICAL edge style
    const breachNode = nodes.find((n) => n.type === "DATA_BREACH");
    expect(breachNode?.category).toBe("THREAT");

    const breachEdge = edges.find((e) => e.type === "EXPOSED_IN");
    expect(breachEdge?.edgeStyle).toBe("CRITICAL");
  });
});
