export interface ExtractedDeviceMetadata {
  reportedIp?: string;
  reportedDevice?: string;
  reportedBrowser?: string;
  reportedLocation?: string;
  isLocationEstimated: boolean;
  explicitEventTimestamp?: string;
}

export class DeviceEventAnalyzer {
  /**
   * Safely decodes a Base64URL or Base64 string to clean UTF-8 text.
   */
  static decodeBase64Url(base64UrlStr: string): string {
    try {
      const base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
      const pad = base64.length % 4;
      const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
      return Buffer.from(padded, "base64").toString("utf-8");
    } catch {
      return "";
    }
  }

  /**
   * Extracts public IP addresses (IPv4), excluding loopbacks and private subnets.
   */
  static extractIpAddress(text: string): string | undefined {
    const ipRegex =
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

    const matches = text.match(ipRegex);
    if (!matches) return undefined;

    for (const ip of matches) {
      // Exclude localhost / private subnets
      if (
        ip.startsWith("127.") ||
        ip === "0.0.0.0" ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        ip.startsWith("169.254.")
      ) {
        continue;
      }
      return ip;
    }

    return undefined;
  }

  /**
   * Extracts device and OS names.
   */
  static extractDevice(text: string): string | undefined {
    if (/\b(?:iPhone|iOS)\b/i.test(text)) return "Apple iPhone";
    if (/\biPad\b/i.test(text)) return "Apple iPad";
    if (/\b(?:MacBook|Macintosh|macOS|OS X)\b/i.test(text)) return "Apple Mac";
    if (/\b(?:Windows 11|Windows 10|Windows PC|Windows)\b/i.test(text)) return "Windows PC";
    if (/\bAndroid\b/i.test(text)) return "Android Device";
    if (/\bChromebook\b/i.test(text)) return "Google Chromebook";
    if (/\bLinux\b/i.test(text)) return "Linux System";
    return undefined;
  }

  /**
   * Extracts client browser name.
   */
  static extractBrowser(text: string): string | undefined {
    if (/\b(?:Chrome|Google Chrome)\b/i.test(text)) return "Google Chrome";
    if (/\b(?:Firefox|Mozilla Firefox)\b/i.test(text)) return "Mozilla Firefox";
    if (/\b(?:Safari)\b/i.test(text) && !/Chrome/i.test(text)) return "Apple Safari";
    if (/\b(?:Edge|Microsoft Edge)\b/i.test(text)) return "Microsoft Edge";
    if (/\b(?:Brave)\b/i.test(text)) return "Brave Browser";
    if (/\b(?:Opera)\b/i.test(text)) return "Opera Browser";
    return undefined;
  }

  /**
   * Extracts reported geographic location mentions (e.g. "Near London, UK", "Bengaluru, India").
   * Always flags isLocationEstimated = true because IP-based geolocation is never a confirmed GPS fact.
   */
  static extractLocation(text: string): { location?: string; isLocationEstimated: boolean } {
    const locMatch =
      text.match(/location[:\s]+([A-Za-z\s]+,\s*[A-Za-z\s]+|[A-Za-z\s]+)/i) ||
      text.match(/near[:\s]+([A-Za-z\s]+,\s*[A-Za-z\s]+|[A-Za-z\s]+)/i) ||
      text.match(/from[:\s]+([A-Za-z\s]+,\s*[A-Za-z\s]+)/i);

    if (locMatch && locMatch[1]) {
      const candidate = locMatch[1].trim();
      // Filter out non-location words
      if (
        candidate &&
        !/^(?:Google|Firefox|Apple|Microsoft|Windows|Chrome|Safari|Linux|Android|Password|Sign-in|Security|Location)/i.test(
          candidate
        )
      ) {
        return {
          location: candidate,
          isLocationEstimated: true,
        };
      }
    }

    return {
      location: undefined,
      isLocationEstimated: true,
    };
  }

  /**
   * Extracts explicit occurrence timestamps mentioned inside the message body/snippet.
   */
  static extractIncidentTimestamp(text: string): string | undefined {
    // Check ISO format in text
    const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/);
    if (isoMatch) {
      try {
        const d = new Date(isoMatch[0]);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch {
        // ignore
      }
    }

    return undefined;
  }

  /**
   * Comprehensive extraction of device, IP, browser, and location metadata.
   */
  static extractAll(text: string): ExtractedDeviceMetadata {
    const reportedIp = this.extractIpAddress(text);
    const reportedDevice = this.extractDevice(text);
    const reportedBrowser = this.extractBrowser(text);
    const { location: reportedLocation, isLocationEstimated } = this.extractLocation(text);
    const explicitEventTimestamp = this.extractIncidentTimestamp(text);

    return {
      reportedIp,
      reportedDevice,
      reportedBrowser,
      reportedLocation,
      isLocationEstimated,
      explicitEventTimestamp,
    };
  }
}
