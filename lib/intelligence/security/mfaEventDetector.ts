import {
  type SecurityEventType,
  type SecurityActionStatus,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";

export interface MfaEventAnalysis {
  eventType: SecurityEventType;
  actionStatus: SecurityActionStatus;
  severity: FindingSeverity;
  title: string;
  description: string;
  isMfaEvent: boolean;
}

export class MfaEventDetector {
  /**
   * Analyzes subject and snippet for Multi-Factor Authentication events.
   */
  static analyze(subject: string, snippet = ""): MfaEventAnalysis {
    const text = `${subject} ${snippet}`.toLowerCase();

    // 1. MFA Disabled (CRITICAL risk if unexpected!)
    if (
      /(?:two[ -]?factor|2fa|mfa|multi[ -]?factor) (?:authentication )?(?:was |has been )?(?:disabled|turned off|removed|deactivated)/i.test(
        text
      )
    ) {
      return {
        isMfaEvent: true,
        eventType: "MFA_DISABLED",
        actionStatus: "COMPLETED",
        severity: "CRITICAL",
        title: "CRITICAL: Multi-Factor Authentication Disabled",
        description:
          "Two-factor authentication was turned off or removed from your account. This significantly increases takeover risk.",
      };
    }

    // 2. MFA Modified / Backup codes / New method added
    if (
      /backup codes (?:generated|viewed)|new (?:authentication|mfa|2fa) method (?:added|registered)|security key (?:added|registered)|authenticator app (?:added|changed)/i.test(
        text
      )
    ) {
      return {
        isMfaEvent: true,
        eventType: "MFA_MODIFIED",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: "MFA Settings or Backup Codes Modified",
        description:
          "New secondary verification methods or replacement backup codes were configured on this account.",
      };
    }

    // 3. MFA Enabled (Good practice, low risk)
    if (
      /(?:two[ -]?factor|2fa|mfa|multi[ -]?factor) (?:authentication )?(?:was |has been )?(?:enabled|turned on|activated)/i.test(
        text
      )
    ) {
      return {
        isMfaEvent: true,
        eventType: "MFA_ENABLED",
        actionStatus: "COMPLETED",
        severity: "INFO",
        title: "Two-Factor Authentication Enabled",
        description:
          "Two-factor authentication was successfully configured, improving your account security posture.",
      };
    }

    return {
      isMfaEvent: false,
      eventType: "MFA_MODIFIED",
      actionStatus: "UNKNOWN",
      severity: "INFO",
      title: "MFA Event",
      description: "Standard multi-factor authentication message.",
    };
  }
}
