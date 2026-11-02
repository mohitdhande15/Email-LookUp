import { type EmailTrackerDetection } from "../privacyTypes";
import { TrackingPixelDetector } from "./trackingPixelDetector";
import { RedirectAnalyzer } from "./redirectAnalyzer";

export interface RawEmailContentInput {
  messageId: string;
  senderDomain: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  bodySnippetOrHtml?: string;
}

export class EmailPrivacyInspector {
  /**
   * Inspects email content in-memory for tracking pixels, beacons, and click-wrapping links.
   * STRICT SAFETY GUARANTEES:
   * 1. Zero HTTP/Network requests executed.
   * 2. Zero raw HTML or body saved to storage.
   */
  static inspect(input: RawEmailContentInput): EmailTrackerDetection | null {
    const content = input.bodySnippetOrHtml ?? "";
    const trackingPixels = TrackingPixelDetector.detectTrackingPixels(content);
    const redirectUrls = RedirectAnalyzer.analyzeRedirectLinks(content);

    if (trackingPixels.length === 0 && redirectUrls.length === 0) {
      return null;
    }

    // Identify primary marketing platform if matched
    const knownPixel = trackingPixels.find((p) => p.trackerName && p.trackerName !== "Generic 1x1 Tracking Pixel");
    const marketingPlatform = knownPixel ? knownPixel.trackerName : undefined;

    const hasZeroSizePixel = trackingPixels.some((p) => p.isZeroSize);
    const severity = hasZeroSizePixel ? "MEDIUM" : "LOW";

    return {
      messageId: input.messageId,
      senderDomain: input.senderDomain,
      senderEmail: input.senderEmail,
      subject: input.subject,
      receivedAt: input.receivedAt,
      trackingPixels,
      redirectUrls,
      marketingPlatform,
      severity,
      verificationStatus: "CONFIRMED_FACT",
    };
  }
}
