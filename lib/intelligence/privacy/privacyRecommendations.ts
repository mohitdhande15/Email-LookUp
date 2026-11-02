import { type FindingAction } from "../core/finding";
import {
  type UnsubscribeCandidate,
  type OAuthAppRecord,
  type CleanupAccountRecord,
  type DataBrokerRecord,
} from "./privacyTypes";

export class PrivacyRecommendations {
  /**
   * Generates actionable recommendations for an unsubscribe candidate.
   */
  static forUnsubscribe(candidate: UnsubscribeCandidate): FindingAction {
    if (candidate.mechanism === "RFC_8058_POST") {
      return {
        id: `act_unsub_rfc_${candidate.domain}`,
        type: "UNSUBSCRIBE_BULK",
        label: `One-Click Unsubscribe from ${candidate.senderName}`,
        description: `Trigger RFC 8058 HTTPS POST to remove your address from ${candidate.domain}'s mailing list without loading tracking images.`,
        actionUrl: candidate.targetUrl,
        priority: candidate.frequencyRating === "DAILY" ? "RECOMMENDED" : "OPTIONAL",
      };
    }

    if (candidate.mechanism === "MAILTO") {
      return {
        id: `act_unsub_mail_${candidate.domain}`,
        type: "UNSUBSCRIBE_BULK",
        label: `Send Unsubscribe Email to ${candidate.senderName}`,
        description: `Dispatch standard automated unsubscribe command email to ${candidate.mailtoAddress}.`,
        actionUrl: `mailto:${candidate.mailtoAddress}?subject=${encodeURIComponent(candidate.mailSubject ?? "Unsubscribe")}`,
        priority: "OPTIONAL",
      };
    }

    return {
      id: `act_unsub_web_${candidate.domain}`,
      type: "UNSUBSCRIBE_BULK",
      label: `Open Unsubscribe Preferences for ${candidate.senderName}`,
      description: `Visit official subscription preferences page on ${candidate.domain}.`,
      actionUrl: candidate.targetUrl,
      priority: "OPTIONAL",
    };
  }

  /**
   * Generates recommendations for third-party OAuth app authorizations.
   */
  static forOAuthApp(app: OAuthAppRecord): FindingAction {
    const isCritical = app.riskRating === "CRITICAL" || app.riskRating === "HIGH";

    return {
      id: `act_oauth_${app.id}`,
      type: "REVIEW_PERMISSIONS",
      label: `Review ${app.appName} Permissions on ${app.provider}`,
      description: `Inspect granted scopes and consider revoking third-party access in your ${app.provider} account security console.`,
      actionUrl: app.managementUrl,
      priority: isCritical ? "IMMEDIATE" : "RECOMMENDED",
    };
  }

  /**
   * Generates recommendations for inactive accounts discovered in cleanup.
   */
  static forCleanupAccount(account: CleanupAccountRecord): FindingAction {
    if (account.directDeleteSupported && account.deleteUrl) {
      return {
        id: `act_clean_del_${account.domain}`,
        type: "DELETE_ACCOUNT",
        label: `Permanently Delete Account on ${account.serviceName}`,
        description: `Follow verified self-service deletion workflow (${account.deletionDifficulty} difficulty).`,
        actionUrl: account.deleteUrl,
        priority: account.daysInactive > 365 ? "RECOMMENDED" : "OPTIONAL",
      };
    }

    return {
      id: `act_clean_legal_${account.domain}`,
      type: "LEGAL_ERASURE_REQUEST",
      label: `Submit Statutory Erasure Request to ${account.serviceName}`,
      description: `Generate formal erasure notice citing GDPR/CCPA to demand removal of personal records from ${account.domain}.`,
      priority: "OPTIONAL",
    };
  }

  /**
   * Generates recommendations for data broker opt-outs.
   */
  static forDataBroker(broker: DataBrokerRecord): FindingAction {
    return {
      id: `act_broker_${broker.id}`,
      type: "DELETE_ACCOUNT",
      label: `Opt Out of ${broker.name}`,
      description: broker.instructions,
      actionUrl: broker.optOutUrl,
      priority: broker.category === "PEOPLE_SEARCH" ? "RECOMMENDED" : "OPTIONAL",
    };
  }
}
