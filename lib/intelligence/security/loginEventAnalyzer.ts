import {
  type SecurityEventType,
  type SecurityActionStatus,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";

export interface LoginEventAnalysis {
  eventType: SecurityEventType;
  actionStatus: SecurityActionStatus;
  severity: FindingSeverity;
  title: string;
  description: string;
  isLoginEvent: boolean;
}

export class LoginEventAnalyzer {
  /**
   * Analyzes subject and snippet to identify authentication and login events.
   */
  static analyze(subject: string, snippet = ""): LoginEventAnalysis {
    const text = `${subject} ${snippet}`.toLowerCase();

    // 1. Blocked / Suspicious sign-in attempts
    if (
      /suspicious (?:sign[ -]?in|login|activity)|blocked sign[ -]?in|prevented sign[ -]?in|unusual sign[ -]?in/i.test(
        text
      )
    ) {
      const isBlocked = /blocked|prevented|denied/i.test(text);
      return {
        isLoginEvent: true,
        eventType: "SUSPICIOUS_ACTIVITY",
        actionStatus: isBlocked ? "BLOCKED" : "ATTEMPTED",
        severity: "HIGH",
        title: "Suspicious Sign-in Alert",
        description: isBlocked
          ? "A suspicious sign-in attempt was detected and blocked by the platform."
          : "An unverified or suspicious sign-in attempt was recorded on your account.",
      };
    }

    // 2. Unfamiliar device / new device sign-in
    if (
      /unfamiliar (?:device|location)|new device|unrecognized (?:device|login)|first time sign[ -]?in/i.test(
        text
      )
    ) {
      return {
        isLoginEvent: true,
        eventType: "UNFAMILIAR_DEVICE_LOGIN",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: "Login from Unfamiliar Device",
        description:
          "Sign-in detected from a device, browser, or geographic region not previously associated with your account.",
      };
    }

    // 3. Failed login warning
    if (
      /failed (?:sign[ -]?in|login)|multiple (?:failed|incorrect) password attempts|too many login attempts/i.test(
        text
      )
    ) {
      return {
        isLoginEvent: true,
        eventType: "FAILED_LOGIN_WARNING",
        actionStatus: "BLOCKED",
        severity: "MEDIUM",
        title: "Failed Login Warning",
        description:
          "Multiple failed sign-in attempts or incorrect password submissions were logged against your account.",
      };
    }

    // 4. Account recovery attempt
    if (/account recovery (?:attempt|requested)|help you sign in|recover your account/i.test(text)) {
      return {
        isLoginEvent: true,
        eventType: "ACCOUNT_RECOVERY_ATTEMPT",
        actionStatus: "ATTEMPTED",
        severity: "HIGH",
        title: "Account Recovery Attempt",
        description:
          "An account recovery flow or identity verification challenge was initiated.",
      };
    }

    // 5. Standard New Login Notification
    if (
      /new sign[ -]?in|new login|logged in to|signed in from|signed in on/i.test(
        text
      )
    ) {
      return {
        isLoginEvent: true,
        eventType: "NEW_LOGIN_DETECTED",
        actionStatus: "COMPLETED",
        severity: "LOW",
        title: "New Sign-in Detected",
        description:
          "A successful sign-in was completed. Verify that this was authorized by you.",
      };
    }

    return {
      isLoginEvent: false,
      eventType: "NEW_LOGIN_DETECTED",
      actionStatus: "UNKNOWN",
      severity: "INFO",
      title: "Authentication Event",
      description: "Standard authentication communication.",
    };
  }
}
