import { describe, it, expect } from "vitest";
import { UnsubscribeSecurity } from "@/lib/intelligence/privacy/unsubscribe/unsubscribeSecurity";

describe("UnsubscribeSecurity SSRF Defense & Protocol Hardening", () => {
  it("rejects non-HTTPS schemes (http, ftp, file, gopher)", async () => {
    const httpRes = await UnsubscribeSecurity.validateUrlForOutboundRequest("http://newsletter.example.com/unsub");
    expect(httpRes.isValid).toBe(false);
    expect(httpRes.errorReason).toContain("strictly HTTPS is required");

    const fileRes = await UnsubscribeSecurity.validateUrlForOutboundRequest("file:///etc/passwd");
    expect(fileRes.isValid).toBe(false);

    const ftpRes = await UnsubscribeSecurity.validateUrlForOutboundRequest("ftp://example.com/unsub");
    expect(ftpRes.isValid).toBe(false);
  });

  it("blocks private IPv4 addresses (RFC 1918, loopback, cloud metadata)", async () => {
    // 127.0.0.1 Loopback
    const loopback = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://127.0.0.1/unsub");
    expect(loopback.isValid).toBe(false);
    expect(loopback.errorReason).toContain("blocked");

    // 169.254.169.254 AWS/GCP/Azure Cloud Metadata
    const metadata = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://169.254.169.254/latest/meta-data/");
    expect(metadata.isValid).toBe(false);
    expect(metadata.errorReason).toContain("169.254.169.254");

    // 10.0.0.1 Private RFC 1918
    const priv10 = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://10.0.0.1/unsub");
    expect(priv10.isValid).toBe(false);

    // 192.168.1.1 Private RFC 1918
    const priv192 = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://192.168.1.1/unsub");
    expect(priv192.isValid).toBe(false);

    // 172.16.0.1 Private RFC 1918
    const priv172 = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://172.16.0.1/unsub");
    expect(priv172.isValid).toBe(false);
  });

  it("blocks private IPv6 addresses (loopback, ULA, link-local)", async () => {
    const v6Loopback = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://[::1]/unsub");
    expect(v6Loopback.isValid).toBe(false);

    const v6Ula = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://[fc00::1]/unsub");
    expect(v6Ula.isValid).toBe(false);

    const v6LinkLocal = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://[fe80::1]/unsub");
    expect(v6LinkLocal.isValid).toBe(false);
  });

  it("blocks localhost and private TLD hostnames", async () => {
    const localhost = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://localhost/unsub");
    expect(localhost.isValid).toBe(false);

    const subLocal = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://api.internal/unsub");
    expect(subLocal.isValid).toBe(false);
  });

  it("blocks URLs with embedded credentials or non-standard ports", async () => {
    const credentials = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://admin:secret@example.com/unsub");
    expect(credentials.isValid).toBe(false);
    expect(credentials.errorReason).toContain("credentials");

    const nonStandardPort = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://example.com:8080/unsub");
    expect(nonStandardPort.isValid).toBe(false);
    expect(nonStandardPort.errorReason).toContain("Non-standard port");
  });

  it("detects DNS rebinding / host resolving to private IP", async () => {
    const mockResolver = async () => [{ address: "192.168.1.50", family: 4 }];
    const res = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://malicious-rebinding.com/unsub", {
      dnsResolver: mockResolver,
    });
    expect(res.isValid).toBe(false);
    expect(res.errorReason).toContain("resolved to blocked IPv4 192.168.1.50");
  });

  it("approves valid public HTTPS URLs resolving to public IPs", async () => {
    const mockResolver = async () => [{ address: "93.184.216.34", family: 4 }];
    const res = await UnsubscribeSecurity.validateUrlForOutboundRequest("https://news.example.com/unsub?token=xyz", {
      dnsResolver: mockResolver,
    });
    expect(res.isValid).toBe(true);
    expect(res.resolvedIp).toBe("93.184.216.34");
  });

  it("provides sanitized outbound headers without authorization or cookie leaks", () => {
    const headers = UnsubscribeSecurity.getSecureOutboundHeaders();
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["Cookie"]).toBeUndefined();
    expect(headers["Authorization"]).toBeUndefined();
  });
});
