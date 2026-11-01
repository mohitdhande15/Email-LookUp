import {
  type SecurityEventType,
  type SecurityActionStatus,
} from "./securityTypes";
import { type FindingSeverity } from "../core/finding";

export interface DeveloperSecurityEventAnalysis {
  eventType: SecurityEventType;
  actionStatus: SecurityActionStatus;
  severity: FindingSeverity;
  title: string;
  description: string;
  isDeveloperOrAccountEvent: boolean;
}

export class ApiKeyEventDetector {
  /**
   * Analyzes subject and snippet for Developer security and Account-level events.
   */
  static analyze(subject: string, snippet = ""): DeveloperSecurityEventAnalysis {
    const text = `${subject} ${snippet}`.toLowerCase();

    // 1. API Key Created
    if (/(?:new )?(?:api key|secret key|personal access token) (?:was |has been )?(?:created|generated)/i.test(text)) {
      return {
        isDeveloperOrAccountEvent: true,
        eventType: "API_KEY_CREATED",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: "New API Key or Token Created",
        description:
          "A programmatic credential with service access privileges was generated.",
      };
    }

    // 2. Token Revoked
    if (/(?:api key|personal access token|token|credential) (?:was |has been )?(?:revoked|deleted)/i.test(text)) {
      return {
        isDeveloperOrAccountEvent: true,
        eventType: "API_TOKEN_REVOKED",
        actionStatus: "COMPLETED",
        severity: "INFO",
        title: "API Token or Key Revoked",
        description:
          "An API credential was revoked or deleted.",
      };
    }

    // 3. OAuth Application Authorized
    if (/authorized (?:a new )?(?:application|app|third[ -]?party)|granted access to|connected app/i.test(text)) {
      return {
        isDeveloperOrAccountEvent: true,
        eventType: "OAUTH_APP_AUTHORIZED",
        actionStatus: "COMPLETED",
        severity: "MEDIUM",
        title: "Third-Party OAuth Application Authorized",
        description:
          "A third-party application was granted delegated API permissions to your account data.",
      };
    }

    // 4. SSH Key Added
    if (/new ssh key (?:added|registered)|ssh key was added/i.test(text)) {
      return {
        isDeveloperOrAccountEvent: true,
        eventType: "SSH_KEY_ADDED",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: "New SSH Key Added to Account",
        description:
          "An SSH public key with shell/git access was added. Verify that this key was configured by you.",
      };
    }

    // 5. Account Suspended
    if (/account (?:has been |was )?suspended|account restricted|service access revoked/i.test(text)) {
      return {
        isDeveloperOrAccountEvent: true,
        eventType: "ACCOUNT_SUSPENDED",
        actionStatus: "COMPLETED",
        severity: "HIGH",
        title: "Account Suspended or Restricted",
        description:
          "Your service account access has been suspended or restricted.",
      };
    }

    // 6. Security Verification Required
    if (/security verification required|action required: verify your account|confirm your identity/i.test(text)) {
      return {
        isDeveloperOrAccountEvent: true,
        eventType: "SECURITY_VERIFICATION_REQUIRED",
        actionStatus: "ATTEMPTED",
        severity: "MEDIUM",
        title: "Security Verification Challenge Required",
        description:
          "An identity verification check or supplementary security confirmation is requested.",
      };
    }

    return {
      isDeveloperOrAccountEvent: false,
      eventType: "API_KEY_CREATED",
      actionStatus: "UNKNOWN",
      severity: "INFO",
      title: "Developer Event",
      description: "Standard developer communication.",
    };
  }
}
