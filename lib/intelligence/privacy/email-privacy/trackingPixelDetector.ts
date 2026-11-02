import { type TrackingPixelIndicator } from "../privacyTypes";

/**
 * Curated list of marketing automation, CRM, and telemetry tracking domains.
 */
export const KNOWN_TRACKER_DOMAINS: Array<{
  domain: string;
  name: string;
}> = [
  { domain: "ct.sendgrid.net", name: "SendGrid Click Tracking" },
  { domain: "sendgrid.net", name: "SendGrid (Twilio)" },
  { domain: "mandrillapp.com", name: "Mailchimp / Mandrill" },
  { domain: "list-manage.com", name: "Mailchimp Newsletter" },
  { domain: "hs-analytics.net", name: "HubSpot Analytics" },
  { domain: "hubspotlinks.com", name: "HubSpot Tracking" },
  { domain: "track.hubspot.com", name: "HubSpot Pixel" },
  { domain: "mktolink.com", name: "Marketo (Adobe)" },
  { domain: "marketo.com", name: "Marketo Tracking" },
  { domain: "click.exacttarget.com", name: "Salesforce Marketing Cloud" },
  { domain: "pardot.com", name: "Salesforce Pardot" },
  { domain: "trk.klaviyo.com", name: "Klaviyo Telemetry" },
  { domain: "klaviyo.com", name: "Klaviyo" },
  { domain: "customeriomail.com", name: "Customer.io Tracking" },
  { domain: "intercom-mail.com", name: "Intercom Open Beacon" },
  { domain: "mailgun.org", name: "Mailgun Tracking" },
  { domain: "appboy.com", name: "Braze (Appboy)" },
  { domain: "braze.com", name: "Braze Engagement" },
  { domain: "activehosted.com", name: "ActiveCampaign" },
  { domain: "litmus.com", name: "Litmus Analytics" },
  { domain: "yesware.com", name: "Yesware Sales Tracker" },
  { domain: "bananatag.com", name: "Staffbase / Bananatag" },
  { domain: "mixpanel.com", name: "Mixpanel Tracking" },
].sort((a, b) => b.domain.length - a.domain.length);

export class TrackingPixelDetector {
  /**
   * Analyzes HTML or email snippet in memory without making network calls.
   * STRICT SAFETY: NEVER fetches remote images or executes scripts.
   */
  static detectTrackingPixels(htmlContent: string): TrackingPixelIndicator[] {
    if (!htmlContent || typeof htmlContent !== "string") {
      return [];
    }

    const detected: TrackingPixelIndicator[] = [];
    const seenUrls = new Set<string>();

    // 1. Match <img> tags
    const imgTagRegex = /<img\b([^>]*?)>/gi;
    let match: RegExpExecArray | null;

    while ((match = imgTagRegex.exec(htmlContent)) !== null) {
      const attributes = match[1];

      // Extract src
      const srcMatch = attributes.match(/\bsrc=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1].trim() : "";

      if (!src || seenUrls.has(src)) continue;

      // Check width / height attributes
      const widthMatch = attributes.match(/\bwidth=["']?([0-9]+)["']?/i);
      const heightMatch = attributes.match(/\bheight=["']?([0-9]+)["']?/i);
      const styleMatch = attributes.match(/\bstyle=["']([^"']+)["']/i);

      let isZeroSize = false;
      const width = widthMatch ? parseInt(widthMatch[1], 10) : undefined;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : undefined;

      if ((width === 0 || width === 1) && (height === 0 || height === 1)) {
        isZeroSize = true;
      }

      if (styleMatch) {
        const style = styleMatch[1].toLowerCase();
        if (
          style.includes("display:none") ||
          style.includes("display: none") ||
          style.includes("visibility:hidden") ||
          style.includes("opacity:0") ||
          style.includes("width:1px") ||
          style.includes("width: 1px") ||
          style.includes("height:1px") ||
          style.includes("height: 1px")
        ) {
          isZeroSize = true;
        }
      }

      // Check for base64 1x1 transparent GIF
      if (src.includes("R0lGODlhAQABA")) {
        isZeroSize = true;
      }

      // Check for known tracking domains
      let matchedTrackerName: string | undefined;
      let matchedTrackerDomain: string | undefined;

      for (const tracker of KNOWN_TRACKER_DOMAINS) {
        if (src.toLowerCase().includes(tracker.domain)) {
          matchedTrackerName = tracker.name;
          matchedTrackerDomain = tracker.domain;
          break;
        }
      }

      // If it's a 1x1/hidden image or from a known tracker domain, register indicator
      if (isZeroSize || matchedTrackerDomain) {
        seenUrls.add(src);
        detected.push({
          trackerName: matchedTrackerName ?? "Generic 1x1 Tracking Pixel",
          trackerDomain: matchedTrackerDomain,
          isZeroSize,
          sourceUrlSnippet: src.length > 100 ? `${src.slice(0, 97)}...` : src,
        });
      }
    }

    return detected;
  }
}
