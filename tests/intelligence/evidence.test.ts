import { describe, it, expect } from "vitest";
import {
  createEvidenceItem,
  generateEvidenceFingerprint,
} from "@/lib/intelligence/core/evidence";

describe("Evidence Engine & Provenance", () => {
  it("generates deterministic fingerprints for identical source and payloads", () => {
    const fp1 = generateEvidenceFingerprint(
      "github_api",
      "PUBLIC_PROFILE",
      JSON.stringify({ login: "alice", id: 123 })
    );

    const fp2 = generateEvidenceFingerprint(
      "github_api",
      "PUBLIC_PROFILE",
      JSON.stringify({ login: "alice", id: 123 })
    );

    expect(fp1).toBe(fp2);
  });

  it("produces distinct fingerprints for different payloads", () => {
    const fp1 = generateEvidenceFingerprint(
      "gmail_header",
      "MAILBOX_HEADER",
      "Message-ID: <1@mail.com>"
    );

    const fp2 = generateEvidenceFingerprint(
      "gmail_header",
      "MAILBOX_HEADER",
      "Message-ID: <2@mail.com>"
    );

    expect(fp1).not.toBe(fp2);
  });

  it("creates evidence items with sanitized snippets and provenance", () => {
    const ev = createEvidenceItem({
      userId: "usr_alice",
      source: "gmail_header",
      type: "MAILBOX_HEADER",
      reliability: "AUTHORITATIVE",
      summary: "Received password reset email from netflix.com",
      rawPayloadToFingerprint: "netflix.com:password_reset:2024-01-01",
      sanitizedSnippet: "From: info@netflix.com, Subject: Reset your password",
      sourceUrl: "https://netflix.com",
    });

    expect(ev.userId).toBe("usr_alice");
    expect(ev.id).toMatch(/^ev_[a-f0-9]{16}$/);
    expect(ev.provenance.fingerprint).toBeDefined();
    expect(ev.provenance.retrievedAt).toBeDefined();
    expect(ev.sanitizedSnippet).not.toContain("password123");
  });
});
