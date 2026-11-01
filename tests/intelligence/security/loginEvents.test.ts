import { describe, it, expect } from "vitest";
import { LoginEventAnalyzer } from "@/lib/intelligence/security/loginEventAnalyzer";

describe("LoginEventAnalyzer", () => {
  it("classifies unfamiliar device logins with completed action status", () => {
    const res = LoginEventAnalyzer.analyze(
      "Security alert: New sign-in from unfamiliar device",
      "We noticed a login from an unrecognized device: Apple iPhone in London, UK."
    );

    expect(res.isLoginEvent).toBe(true);
    expect(res.eventType).toBe("UNFAMILIAR_DEVICE_LOGIN");
    expect(res.actionStatus).toBe("COMPLETED");
    expect(res.severity).toBe("HIGH");
  });

  it("classifies suspicious login attempts that were blocked", () => {
    const res = LoginEventAnalyzer.analyze(
      "Critical security alert: Suspicious sign-in prevented",
      "Google blocked someone from signing into your account using your password."
    );

    expect(res.isLoginEvent).toBe(true);
    expect(res.eventType).toBe("SUSPICIOUS_ACTIVITY");
    expect(res.actionStatus).toBe("BLOCKED");
    expect(res.severity).toBe("HIGH");
  });

  it("classifies failed login warnings", () => {
    const res = LoginEventAnalyzer.analyze(
      "Warning: Multiple failed sign-in attempts",
      "5 incorrect password attempts were logged on your account."
    );

    expect(res.isLoginEvent).toBe(true);
    expect(res.eventType).toBe("FAILED_LOGIN_WARNING");
    expect(res.actionStatus).toBe("BLOCKED");
  });

  it("classifies account recovery challenges as attempted", () => {
    const res = LoginEventAnalyzer.analyze(
      "Account recovery attempt initiated",
      "Someone started a recovery flow for your account."
    );

    expect(res.isLoginEvent).toBe(true);
    expect(res.eventType).toBe("ACCOUNT_RECOVERY_ATTEMPT");
    expect(res.actionStatus).toBe("ATTEMPTED");
  });

  it("classifies standard new logins as low severity", () => {
    const res = LoginEventAnalyzer.analyze(
      "New sign-in to your Google Account",
      "Your Google Account was accessed from a Mac."
    );

    expect(res.isLoginEvent).toBe(true);
    expect(res.eventType).toBe("NEW_LOGIN_DETECTED");
    expect(res.severity).toBe("LOW");
  });
});
