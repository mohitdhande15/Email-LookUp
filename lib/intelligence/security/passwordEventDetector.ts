import {
  type SecurityEventType,
  type SecurityActionStatus,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";

export interface PasswordEventAnalysis {
  eventType: SecurityEventType;
  actionStatus: SecurityActionStatus;
  severity: FindingSeverity;
  title: string;
  description: string;
  isPasswordEvent: boolean;
}

export class PasswordEventDetector {
  /**
   * Analyzes subject and snippet to detect password modifications and reset events.
   */
  static analyze(subject: string, snippet = ""): PasswordEventAnalysis {
    const text = `${subject} ${snippet}`.toLowerCase();

    // 1. Password changed (completed)
    if (
      /password (?:was |has been )?(?:changed|updated|reset successfully)|successfully changed your password/i.test(
        text
      )
    ) {
      return {
        isPasswordEvent: true,
        eventType: "PASSWORD_CHANGED",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: "Account Password Changed",
        description:
          "The password for this service was changed. If you did not initiate this change, your credentials may be compromised.",
      };
    }

    // 2. Password reset request (attempted)
    if (
      /reset your password|password reset request|link to reset your password|forgot your password|temporary password/i.test(
        text
      )
    ) {
      return {
        isPasswordEvent: true,
        eventType: "PASSWORD_RESET",
        actionStatus: "ATTEMPTED",
        severity: "MEDIUM",
        title: "Password Reset Requested",
        description:
          "A password reset link or verification code was requested for your account.",
      };
    }

    return {
      isPasswordEvent: false,
      eventType: "PASSWORD_RESET",
      actionStatus: "UNKNOWN",
      severity: "INFO",
      title: "Credential Notice",
      description: "Standard credential communication.",
    };
  }
}
