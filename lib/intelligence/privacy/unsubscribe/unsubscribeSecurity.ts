import dns from "node:dns";
import net from "node:net";

export interface SsrValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  resolvedIp?: string;
  errorReason?: string;
}

/**
 * Parses IPv4 string to 32-bit unsigned integer.
 */
function ipv4ToLong(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

/**
 * Checks whether an IPv4 address is in a CIDR range.
 */
function isIpv4InCidr(ip: string, cidrNet: string, maskBits: number): boolean {
  const ipLong = ipv4ToLong(ip);
  const netLong = ipv4ToLong(cidrNet);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipLong & mask) === (netLong & mask);
}

/**
 * Known Dangerous / Private / Link-Local / Reserved IPv4 ranges:
 * - 0.0.0.0/8 (Broadcast/Current net)
 * - 10.0.0.0/8 (RFC 1918 Private)
 * - 100.64.0.0/10 (Shared Address Space / CGNAT)
 * - 127.0.0.0/8 (RFC 1122 Loopback)
 * - 169.254.0.0/16 (RFC 3927 Link-Local / Cloud Metadata 169.254.169.254)
 * - 172.16.0.0/12 (RFC 1918 Private)
 * - 192.0.0.0/24 (IETF Protocol Assignments)
 * - 192.0.2.0/24 (TEST-NET-1)
 * - 192.88.99.0/24 (6to4 Relay Anycast)
 * - 192.168.0.0/16 (RFC 1918 Private)
 * - 198.18.0.0/15 (Network Benchmark Testing)
 * - 198.51.100.0/24 (TEST-NET-2)
 * - 203.0.113.0/24 (TEST-NET-3)
 * - 224.0.0.0/4 (Multicast)
 * - 240.0.0.0/4 (Reserved for Future Use)
 * - 255.255.255.255/32 (Broadcast)
 */
const BLOCKED_IPV4_RANGES: Array<{ net: string; mask: number; reason: string }> = [
  { net: "0.0.0.0", mask: 8, reason: "Current network / default route" },
  { net: "10.0.0.0", mask: 8, reason: "RFC 1918 Private network" },
  { net: "100.64.0.0", mask: 10, reason: "Carrier-grade NAT" },
  { net: "127.0.0.0", mask: 8, reason: "Loopback address" },
  { net: "169.254.0.0", mask: 16, reason: "Link-Local / Cloud Metadata (169.254.169.254)" },
  { net: "172.16.0.0", mask: 12, reason: "RFC 1918 Private network" },
  { net: "192.0.0.0", mask: 24, reason: "IETF Protocol Assignments" },
  { net: "192.0.2.0", mask: 24, reason: "TEST-NET-1 documentation" },
  { net: "192.88.99.0", mask: 24, reason: "6to4 Relay" },
  { net: "192.168.0.0", mask: 16, reason: "RFC 1918 Private network" },
  { net: "198.18.0.0", mask: 15, reason: "Benchmark testing" },
  { net: "198.51.100.0", mask: 24, reason: "TEST-NET-2 documentation" },
  { net: "203.0.113.0", mask: 24, reason: "TEST-NET-3 documentation" },
  { net: "224.0.0.0", mask: 4, reason: "Multicast" },
  { net: "240.0.0.0", mask: 4, reason: "Reserved space" },
  { net: "255.255.255.255", mask: 32, reason: "Limited Broadcast" },
];

/**
 * Checks whether an IPv6 address is private, loopback, or cloud-internal.
 */
function isBlockedIpv6(ip: string): { blocked: boolean; reason?: string } {
  const normalized = ip.toLowerCase().trim();

  // IPv6 Loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return { blocked: true, reason: "IPv6 Loopback" };
  }

  // IPv6 Unspecified
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") {
    return { blocked: true, reason: "IPv6 Unspecified address" };
  }

  // Unique Local (fc00::/7) -> fc.. or fd..
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return { blocked: true, reason: "IPv6 Unique Local Address (ULA)" };
  }

  // Link-Local (fe80::/10) -> fe8, fe9, fea, feb
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return { blocked: true, reason: "IPv6 Link-Local address" };
  }

  // IPv4-mapped IPv6 (::ffff:192.168.1.1 or ::ffff:c0a8:0101)
  if (normalized.startsWith("::ffff:") || normalized.startsWith("0:0:0:0:0:ffff:")) {
    const v4Part = normalized.split(":").pop() ?? "";
    if (net.isIPv4(v4Part)) {
      const v4Check = checkIpv4Address(v4Part);
      if (v4Check.blocked) {
        return { blocked: true, reason: `IPv4-mapped ${v4Check.reason}` };
      }
    }
    return { blocked: true, reason: "IPv4-mapped IPv6 address prohibited" };
  }

  return { blocked: false };
}

function checkIpv4Address(ip: string): { blocked: boolean; reason?: string } {
  for (const range of BLOCKED_IPV4_RANGES) {
    if (isIpv4InCidr(ip, range.net, range.mask)) {
      return { blocked: true, reason: range.reason };
    }
  }
  return { blocked: false };
}

export class UnsubscribeSecurity {
  /**
   * Evaluates if a target URL is safe to invoke for RFC 8058 POST.
   * Performs protocol inspection, hostname checks, and DNS resolution to prevent SSRF and DNS rebinding.
   */
  static async validateUrlForOutboundRequest(
    targetUrl: string,
    options: {
      dnsResolver?: (hostname: string) => Promise<{ address: string; family: number }[]>;
    } = {}
  ): Promise<SsrValidationResult> {
    if (!targetUrl || typeof targetUrl !== "string") {
      return { isValid: false, errorReason: "URL is empty or not a string" };
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl.trim());
    } catch {
      return { isValid: false, errorReason: "Malformed URL syntax" };
    }

    // 1. Strict Protocol check: HTTPS ONLY
    if (parsed.protocol.toLowerCase() !== "https:") {
      return {
        isValid: false,
        errorReason: `Protocol '${parsed.protocol}' is prohibited; strictly HTTPS is required`,
      };
    }

    // 2. Reject credentials in URL
    if (parsed.username || parsed.password) {
      return {
        isValid: false,
        errorReason: "URL contains userinfo/embedded credentials (SSRF risk)",
      };
    }

    // 3. Reject non-standard ports (strictly standard HTTPS 443 or default)
    if (parsed.port && parsed.port !== "443") {
      return {
        isValid: false,
        errorReason: `Non-standard port '${parsed.port}' is blocked for unsubscribe requests`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 4. Prohibit localhost and private TLDs
    const BLOCKED_HOST_SUFFIXES = [
      "localhost",
      ".localhost",
      ".local",
      ".internal",
      ".lan",
      ".home.arpa",
      ".corp",
      ".domain",
      ".test",
      ".example",
      ".invalid",
    ];

    if (
      hostname === "localhost" ||
      BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      return {
        isValid: false,
        errorReason: `Hostname '${hostname}' matches prohibited private or internal TLD`,
      };
    }

    // 5. If hostname is already a raw IP literal
    if (net.isIPv4(hostname)) {
      const v4Check = checkIpv4Address(hostname);
      if (v4Check.blocked) {
        return {
          isValid: false,
          errorReason: `Direct IP ${hostname} is blocked: ${v4Check.reason}`,
        };
      }
      return {
        isValid: true,
        sanitizedUrl: parsed.toString(),
        resolvedIp: hostname,
      };
    }

    if (net.isIPv6(hostname)) {
      const v6Check = isBlockedIpv6(hostname);
      if (v6Check.blocked) {
        return {
          isValid: false,
          errorReason: `Direct IPv6 ${hostname} is blocked: ${v6Check.reason}`,
        };
      }
      return {
        isValid: true,
        sanitizedUrl: parsed.toString(),
        resolvedIp: hostname,
      };
    }

    // 6. Resolve DNS to verify public IP address
    const resolver =
      options.dnsResolver ??
      (async (host: string) => {
        return await dns.promises.lookup(host, { all: true });
      });

    try {
      const addresses = await resolver(hostname);
      if (!addresses || addresses.length === 0) {
        return {
          isValid: false,
          errorReason: `DNS resolution returned no addresses for '${hostname}'`,
        };
      }

      for (const entry of addresses) {
        const ip = entry.address;
        if (entry.family === 4 || net.isIPv4(ip)) {
          const check = checkIpv4Address(ip);
          if (check.blocked) {
            return {
              isValid: false,
              resolvedIp: ip,
              errorReason: `Host '${hostname}' resolved to blocked IPv4 ${ip} (${check.reason})`,
            };
          }
        } else if (entry.family === 6 || net.isIPv6(ip)) {
          const check = isBlockedIpv6(ip);
          if (check.blocked) {
            return {
              isValid: false,
              resolvedIp: ip,
              errorReason: `Host '${hostname}' resolved to blocked IPv6 ${ip} (${check.reason})`,
            };
          }
        }
      }

      return {
        isValid: true,
        sanitizedUrl: parsed.toString(),
        resolvedIp: addresses[0].address,
      };
    } catch (err) {
      return {
        isValid: false,
        errorReason: `DNS resolution failed for '${hostname}': ${(err as Error).message}`,
      };
    }
  }

  /**
   * Sanitizes outbound headers: strictly strip cookies, tokens, auth headers.
   */
  static getSecureOutboundHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "EmailLookup-PrivacyEngine/1.0 (+https://github.com/mohitdhande15/Email-LookUp)",
      // Explicitly no Cookie, Authorization, or Session headers
    };
  }
}
