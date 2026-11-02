import { type RedirectLinkIndicator } from "../privacyTypes";

const REDIRECT_PARAM_KEYS = ["url", "dest", "destination", "redirect", "target", "link", "r", "u", "to"];

export class RedirectAnalyzer {
  /**
   * Analyzes URLs within an email message in memory to identify telemetry redirects.
   * STRICT SAFETY: Zero network requests are made.
   */
  static analyzeRedirectLinks(htmlContent: string): RedirectLinkIndicator[] {
    if (!htmlContent || typeof htmlContent !== "string") {
      return [];
    }

    const detected: RedirectLinkIndicator[] = [];
    const seenLinks = new Set<string>();

    // Match href attributes: href="..."
    const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefRegex.exec(htmlContent)) !== null) {
      const rawUrl = match[1].trim();
      if (seenLinks.has(rawUrl)) continue;
      seenLinks.add(rawUrl);

      try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();

        // Check if hostname has redirect/tracking keywords
        const isTrackingHost =
          host.startsWith("click.") ||
          host.startsWith("trk.") ||
          host.startsWith("track.") ||
          host.startsWith("link.") ||
          host.startsWith("email.") ||
          host.includes("sendgrid.net") ||
          host.includes("mandrillapp.com") ||
          host.includes("hubspotlinks.com");

        // Inspect search params for embedded target URL
        let embeddedTargetDomain: string | undefined;
        let matchedParamKey: string | undefined;

        for (const key of REDIRECT_PARAM_KEYS) {
          const val = parsed.searchParams.get(key);
          if (val && (val.startsWith("http://") || val.startsWith("https://"))) {
            try {
              const targetParsed = new URL(val);
              embeddedTargetDomain = targetParsed.hostname.toLowerCase();
              matchedParamKey = key;
              break;
            } catch {
              // Not a valid URL in param
            }
          }
        }

        if (isTrackingHost || embeddedTargetDomain) {
          detected.push({
            redirectDomain: host,
            targetDomain: embeddedTargetDomain,
            wrapperPattern: matchedParamKey ? `Query Param: ?${matchedParamKey}=` : "Subdomain click/telemetry redirect",
          });
        }
      } catch {
        // Skip malformed URL
      }
    }

    return detected;
  }
}
