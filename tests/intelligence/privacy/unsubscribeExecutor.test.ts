import { describe, it, expect, vi } from "vitest";
import { UnsubscribeExecutor } from "@/lib/intelligence/privacy/unsubscribe/unsubscribeExecutor";
import { type UnsubscribeCandidate } from "@/lib/intelligence/privacy/privacyTypes";

describe("UnsubscribeExecutor Execution & SSRF Enforcement", () => {
  const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

  it("executes RFC 8058 POST with correct headers and body", async () => {
    const candidate: UnsubscribeCandidate = {
      id: "unsub_test_1",
      domain: "newsletter.example.com",
      senderName: "Test Newsletter",
      senderEmail: "news@example.com",
      mechanism: "RFC_8058_POST",
      targetUrl: "https://newsletter.example.com/api/one-click-unsub",
      frequencyRating: "WEEKLY",
      emailCount: 5,
      status: "PENDING",
    };

    let capturedUrl = "";
    let capturedMethod = "";
    let capturedBody = "";
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method ?? "GET";
      capturedBody = (init?.body as string) ?? "";
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};

      return new Response(JSON.stringify({ status: "unsubscribed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await UnsubscribeExecutor.executeUnsubscribe(candidate, {
      fetchImpl: mockFetch,
      dnsResolver: publicResolver,
    });

    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(capturedUrl).toBe("https://newsletter.example.com/api/one-click-unsub");
    expect(capturedMethod).toBe("POST");
    expect(capturedBody).toBe("List-Unsubscribe=One-Click");
    expect(capturedHeaders["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(capturedHeaders["Cookie"]).toBeUndefined();
    expect(capturedHeaders["Authorization"]).toBeUndefined();
  });

  it("blocks outbound POST if target URL fails SSRF validation", async () => {
    const candidate: UnsubscribeCandidate = {
      id: "unsub_ssrf_attack",
      domain: "attacker.com",
      senderName: "Attacker",
      senderEmail: "attacker@attacker.com",
      mechanism: "RFC_8058_POST",
      targetUrl: "https://169.254.169.254/latest/meta-data/",
      frequencyRating: "OCCASIONAL",
      emailCount: 1,
      status: "PENDING",
    };

    const mockFetch = vi.fn();
    const result = await UnsubscribeExecutor.executeUnsubscribe(candidate, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("SSRF Security Policy Rejection");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles Mailto candidates by producing client mailto intent", async () => {
    const candidate: UnsubscribeCandidate = {
      id: "unsub_mailto_1",
      domain: "mailservice.com",
      senderName: "Mail Service",
      senderEmail: "news@mailservice.com",
      mechanism: "MAILTO",
      mailtoAddress: "unsub@mailservice.com",
      mailSubject: "Unsubscribe Me",
      frequencyRating: "DAILY",
      emailCount: 12,
      status: "PENDING",
    };

    const result = await UnsubscribeExecutor.executeUnsubscribe(candidate);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Mailto handler prepared");
    expect(result.auditSnippet).toContain("mailto:unsub@mailservice.com");
  });

  it("follows safe redirects and blocks redirect hops to private IPs", async () => {
    const candidate: UnsubscribeCandidate = {
      id: "unsub_redirect_trap",
      domain: "redirector.com",
      senderName: "Redirector",
      senderEmail: "news@redirector.com",
      mechanism: "RFC_8058_POST",
      targetUrl: "https://redirector.com/first-hop",
      frequencyRating: "OCCASIONAL",
      emailCount: 1,
      status: "PENDING",
    };

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("first-hop")) {
        return new Response(null, {
          status: 302,
          headers: { Location: "https://127.0.0.1/private-endpoint" },
        });
      }
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await UnsubscribeExecutor.executeUnsubscribe(candidate, {
      fetchImpl: mockFetch,
      dnsResolver: publicResolver,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Redirect target rejected by SSRF Policy");
  });
});
