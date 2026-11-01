import {
  type SecurityEventType,
  type SecurityActionStatus,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";

export interface RecoveryEventAnalysis {
  eventType: SecurityEventType;
  actionStatus: SecurityActionStatus;
  severity: FindingSeverity;
  title: string;
  description: string;
  isRecoveryEvent: boolean;
}

export class RecoveryEventDetector {
  /**
   * Analyzes subject and snippet for account recovery modification events.
   */
  static analyze(subject: string, snippet = ""): RecoveryEventAnalysis {
    const text = `${subject} ${snippet}`.toLowerCase();

    if (
      /recovery email (?:was |has been )?(?:changed|updated|added|removed)|alternate email (?:changed|updated)|recovery phone (?:was |has been )?(?:changed|updated|added|removed)|sms verification number (?:changed|updated)/i.test(
        text
      )
    ) {
      const isEmail = /email/i.test(text);
      return {
        isRecoveryEvent: true,
        eventType: "RECOVERY_INFO_CHANGED",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: isEmail ? "Recovery Email Address Changed" : "Recovery Phone Number Changed",
        description:
          "The secondary recovery address or verification phone was modified. Attackers frequently alter recovery info to maintain persistence.",
      };
    }

    return {
      isRecoveryEvent: false,
      eventType: "RECOVERY_INFO_CHANGED",
      actionStatus: "UNKNOWN",
      severity: "INFO",
      title: "Recovery Event",
      description: "Standard account recovery message.",
    };
  }
}
