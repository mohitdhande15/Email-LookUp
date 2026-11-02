import { describe, it, expect } from "vitest";
import { TrackingPixelDetector } from "@/lib/intelligence/privacy/email-privacy/trackingPixelDetector";
import { RedirectAnalyzer } from "@/lib/intelligence/privacy/email-privacy/redirectAnalyzer";
import { EmailPrivacyInspector } from "@/lib/intelligence/privacy/email-privacy/emailPrivacyInspector";

describe("Email Privacy Inspector (Zero Remote Fetch Telemetry Analysis)", () => {
  it("detects 1x1 zero-size tracking images", () => {
    const html = `
      <p>Hello valued subscriber!</p>
      <img src="https://tracking.marketingcorp.com/beacon.gif" width="1" height="1" alt="" />
      <p>Enjoy your newsletter.</p>
    `;

    const detected = TrackingPixelDetector.detectTrackingPixels(html);
    expect(detected.length).toBe(1);
    expect(detected[0].isZeroSize).toBe(true);
  });

  it("detects CSS-hidden or 0-pixel beacons", () => {
    const html = `
      <img src="https://telemetry.analytics.io/pixel" style="display:none; width:0px; height:0px;" />
    `;

    const detected = TrackingPixelDetector.detectTrackingPixels(html);
    expect(detected.length).toBe(1);
    expect(detected[0].isZeroSize).toBe(true);
  });

  it("detects known marketing automation telemetry domains", () => {
    const html = `
      <img src="https://ct.sendgrid.net/wf/open?upn=xyz" />
      <img src="https://track.hubspot.com/__ptq.gif?k=14" />
    `;

    const detected = TrackingPixelDetector.detectTrackingPixels(html);
    expect(detected.length).toBe(2);

    const sendgrid = detected.find((d) => d.trackerDomain === "ct.sendgrid.net");
    expect(sendgrid).toBeDefined();
    expect(sendgrid?.trackerName).toContain("SendGrid");

    const hubspot = detected.find((d) => d.trackerDomain === "track.hubspot.com");
    expect(hubspot).toBeDefined();
    expect(hubspot?.trackerName).toContain("HubSpot");
  });

  it("detects wrapped click-tracking redirect URLs without navigating", () => {
    const html = `
      <a href="https://click.sendgrid.net/ls/click?upn=abc&url=https%3A%2F%2Fstore.example.com%2Fshoes">Shop Shoes</a>
    `;

    const redirects = RedirectAnalyzer.analyzeRedirectLinks(html);
    expect(redirects.length).toBe(1);
    expect(redirects[0].redirectDomain).toBe("click.sendgrid.net");
    expect(redirects[0].targetDomain).toBe("store.example.com");
  });

  it("combines detections into unified EmailTrackerDetection with zero-body retention", () => {
    const inspection = EmailPrivacyInspector.inspect({
      messageId: "msg_promo_1",
      senderDomain: "fashionbrand.com",
      senderEmail: "news@fashionbrand.com",
      subject: "Flash Sale 50% Off",
      receivedAt: "2026-10-31T12:00:00Z",
      bodySnippetOrHtml: `
        <div>Check out our sale!</div>
        <img src="https://trk.klaviyo.com/open.png" width="1" height="1" />
        <a href="https://trk.klaviyo.com/redirect?dest=https%3A%2F%2Ffashionbrand.com%2Fsale">Click here</a>
      `,
    });

    expect(inspection).not.toBeNull();
    expect(inspection?.marketingPlatform).toContain("Klaviyo");
    expect(inspection?.trackingPixels.length).toBe(1);
    expect(inspection?.redirectUrls.length).toBe(1);
    expect(inspection?.severity).toBe("MEDIUM");
  });
});
