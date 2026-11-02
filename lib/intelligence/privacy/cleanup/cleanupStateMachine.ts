import {
  type CleanupAccountRecord,
  type CleanupAccountStatus,
} from "../privacyTypes";
import { DeletionDifficultyEvaluator } from "./deletionDifficulty";

/**
 * Valid state transitions for Account Cleanup lifecycle.
 */
export const VALID_TRANSITIONS: Record<CleanupAccountStatus, CleanupAccountStatus[]> = {
  DISCOVERED: ["UNDER_REVIEW", "KEEP_ACCOUNT", "CLEANUP_PLANNED"],
  UNDER_REVIEW: ["KEEP_ACCOUNT", "CLEANUP_PLANNED", "DISCOVERED"],
  KEEP_ACCOUNT: ["UNDER_REVIEW", "CLEANUP_PLANNED"],
  CLEANUP_PLANNED: ["UNSUBSCRIBE_PENDING", "DELETION_REQUESTED", "KEEP_ACCOUNT", "UNDER_REVIEW"],
  UNSUBSCRIBE_PENDING: ["UNSUBSCRIBED", "ACTION_REQUIRED", "CLEANUP_PLANNED"],
  UNSUBSCRIBED: ["DELETION_REQUESTED", "KEEP_ACCOUNT", "CLEANUP_PLANNED"],
  DELETION_REQUESTED: ["RESPONSE_RECEIVED", "DELETION_CONFIRMED", "REJECTED", "ACTION_REQUIRED"],
  RESPONSE_RECEIVED: ["DELETION_CONFIRMED", "REJECTED", "ACTION_REQUIRED"],
  ACTION_REQUIRED: ["DELETION_REQUESTED", "UNDER_REVIEW", "KEEP_ACCOUNT", "CLEANUP_PLANNED"],
  REJECTED: ["UNDER_REVIEW", "DELETION_REQUESTED", "KEEP_ACCOUNT"],
  DELETION_CONFIRMED: ["UNDER_REVIEW"], // Terminal state; can only reopen if fresh activity occurs
};

export class CleanupStateMachine {
  /**
   * Verifies if transition is permissible under the formal lifecycle.
   */
  static canTransition(from: CleanupAccountStatus, to: CleanupAccountStatus): boolean {
    if (from === to) return true;
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Applies state transition and records timestamped transition audit history.
   */
  static transitionAccount(
    record: CleanupAccountRecord,
    toStatus: CleanupAccountStatus,
    note?: string
  ): CleanupAccountRecord {
    if (!this.canTransition(record.status, toStatus)) {
      throw new Error(
        `Invalid lifecycle transition: Cannot transition from '${record.status}' to '${toStatus}'`
      );
    }

    const now = new Date().toISOString();
    const transitionHistory = [
      ...record.statusHistory,
      {
        from: record.status,
        to: toStatus,
        changedAt: now,
        note,
      },
    ];

    return {
      ...record,
      status: toStatus,
      statusHistory: transitionHistory,
    };
  }

  /**
   * Instantiates a new CleanupAccountRecord with difficulty rating.
   */
  static createAccountRecord(params: {
    userId: string;
    domain: string;
    serviceName: string;
    daysInactive?: number;
    lastActivityDate?: string;
    initialStatus?: CleanupAccountStatus;
    notes?: string;
  }): CleanupAccountRecord {
    const cleanDomain = params.domain.toLowerCase().trim();
    const { rating, deleteUrl, hasDirectLink } =
      DeletionDifficultyEvaluator.evaluateDifficulty(cleanDomain);

    const initialStatus: CleanupAccountStatus = params.initialStatus ?? "DISCOVERED";
    const now = new Date().toISOString();

    const id = `cln_${cleanDomain.replace(/[^a-z0-9]/g, "_")}`;

    return {
      id,
      userId: params.userId,
      domain: cleanDomain,
      serviceName: params.serviceName,
      status: initialStatus,
      deletionDifficulty: rating,
      deleteUrl,
      directDeleteSupported: hasDirectLink,
      daysInactive: params.daysInactive ?? 0,
      lastActivityDate: params.lastActivityDate,
      statusHistory: [
        {
          from: initialStatus,
          to: initialStatus,
          changedAt: now,
          note: "Account discovered in mailbox scan",
        },
      ],
      notes: params.notes,
    };
  }
}
