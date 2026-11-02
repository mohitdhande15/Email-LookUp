import { describe, it, expect } from "vitest";
import { UnsubscribeDetector } from "@/lib/intelligence/privacy/unsubscribe/unsubscribeDetector";

describe("UnsubscribeDetector RFC 2369 & RFC 8058 Header Parsing", () => {
  it("detects RFC 8058 One-Click HTTPS POST when both headers are present", () => {
    const listUnsub = "<https://unsubscribe.service.com/one-click/token123>, <mailto:unsub@service.com>";
    const listUnsubPost = "List-Unsubscribe=One-Click";

    const result = UnsubscribeDetector.detectMechanism(listUnsub, listUnsubPost);
    expect(result.mechanism).toBe("RFC_8058_POST");
    expect(result.targetUrl).toBe("https://unsubscribe.service.com/one-click/token123");
  });

  it("classifies as WEB_FORM when HTTPS URL is present without RFC 8058 POST header", () => {
    const listUnsub = "<https://service.com/optout?id=456>";
    const result = UnsubscribeDetector.detectMechanism(listUnsub, undefined);
    expect(result.mechanism).toBe("WEB_FORM");
    expect(result.targetUrl).toBe("https://service.com/optout?id=456");
  });

  it("classifies as MAILTO when only mailto URI is present", () => {
    const listUnsub = "<mailto:leave-list@example.com?subject=unsubscribe-now>";
    const result = UnsubscribeDetector.detectMechanism(listUnsub);
    expect(result.mechanism).toBe("MAILTO");
    expect(result.mailtoAddress).toBe("leave-list@example.com");
    expect(result.mailSubject).toBe("unsubscribe-now");
  });

  it("correctly calculates frequency ratings based on email volume", () => {
    const candidateDaily = UnsubscribeDetector.createCandidate({
      domain: "dailydeals.com",
      senderName: "Daily Deals",
      senderEmail: "deals@dailydeals.com",
      listUnsubscribeHeader: "<https://dailydeals.com/unsub>",
      emailCount: 15,
    });
    expect(candidateDaily.frequencyRating).toBe("DAILY");

    const candidateWeekly = UnsubscribeDetector.createCandidate({
      domain: "weeklydigest.com",
      senderName: "Weekly Digest",
      senderEmail: "news@weeklydigest.com",
      listUnsubscribeHeader: "<https://weeklydigest.com/unsub>",
      emailCount: 4,
    });
    expect(candidateWeekly.frequencyRating).toBe("WEEKLY");

    const candidateOccasional = UnsubscribeDetector.createCandidate({
      domain: "rarealerts.org",
      senderName: "Rare Alerts",
      senderEmail: "info@rarealerts.org",
      listUnsubscribeHeader: "<https://rarealerts.org/unsub>",
      emailCount: 1,
    });
    expect(candidateOccasional.frequencyRating).toBe("OCCASIONAL");
  });
});
