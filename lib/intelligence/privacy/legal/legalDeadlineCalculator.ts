import {
  type LegalRegulation,
  type LegalRequestStatus,
  type LegalErasureTrackedRequest,
} from "../privacyTypes";
import {
  JURISDICTION_RULES,
  isRegulationCurrentlyEnforceable,
} from "./jurisdictionRegistry";

export interface DeadlineCalculationResult {
  initialDeadlineDate: string;
  extensionDeadlineDate?: string;
  effectiveDeadlineDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  status: LegalRequestStatus;
  isStatutoryEnforceable: boolean;
  statutoryCommencementDate?: string;
  urgencyLevel: "CRITICAL" | "HIGH" | "NORMAL" | "EXPIRED" | "COMPLETED";
}

export class LegalDeadlineCalculator {
  /**
   * Calculates statutory deadline dates, days remaining, and urgency for a request.
   */
  static calculateDeadlines(
    request: {
      regulation: LegalRegulation;
      requestDate: string;
      isExtensionClaimed?: boolean;
      status?: LegalRequestStatus;
    },
    asOfDate: Date = new Date()
  ): DeadlineCalculationResult {
    const rule = JURISDICTION_RULES[request.regulation];
    const reqDate = new Date(request.requestDate);

    // Initial deadline
    const initialDeadline = new Date(
      reqDate.getTime() + rule.initialDeadlineDays * 24 * 60 * 60 * 1000
    );

    // Extension deadline if claimed
    let extensionDeadline: Date | undefined;
    if (request.isExtensionClaimed) {
      extensionDeadline = new Date(
        reqDate.getTime() +
          (rule.initialDeadlineDays + rule.maxExtensionDays) * 24 * 60 * 60 * 1000
      );
    }

    const effectiveDeadline = extensionDeadline ?? initialDeadline;
    const diffMs = effectiveDeadline.getTime() - asOfDate.getTime();
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    const isCompleted = request.status === "COMPLETED";
    const isOverdue = !isCompleted && daysRemaining < 0;

    let computedStatus: LegalRequestStatus = request.status ?? "SUBMITTED";
    if (isOverdue) {
      computedStatus = "OVERDUE";
    }

    let urgencyLevel: "CRITICAL" | "HIGH" | "NORMAL" | "EXPIRED" | "COMPLETED" =
      "NORMAL";
    if (isCompleted) {
      urgencyLevel = "COMPLETED";
    } else if (isOverdue) {
      urgencyLevel = "EXPIRED";
    } else if (daysRemaining <= 3) {
      urgencyLevel = "CRITICAL";
    } else if (daysRemaining <= 7) {
      urgencyLevel = "HIGH";
    }

    const isEnforceable = isRegulationCurrentlyEnforceable(
      request.regulation,
      asOfDate
    );

    return {
      initialDeadlineDate: initialDeadline.toISOString(),
      extensionDeadlineDate: extensionDeadline?.toISOString(),
      effectiveDeadlineDate: effectiveDeadline.toISOString(),
      daysRemaining,
      isOverdue,
      status: computedStatus,
      isStatutoryEnforceable: isEnforceable,
      statutoryCommencementDate: rule.statutoryCommencementDate,
      urgencyLevel,
    };
  }

  /**
   * Creates a new fully initialized LegalErasureTrackedRequest.
   */
  static createTrackedRequest(params: {
    userId: string;
    targetDomain: string;
    serviceName: string;
    regulation: LegalRegulation;
    contactEmail: string;
    requestDate?: string;
    referenceNumber?: string;
    notes?: string;
  }): LegalErasureTrackedRequest {
    const requestDate = params.requestDate ?? new Date().toISOString();
    const rule = JURISDICTION_RULES[params.regulation];
    const deadlines = this.calculateDeadlines({
      regulation: params.regulation,
      requestDate,
      isExtensionClaimed: false,
      status: "SUBMITTED",
    });

    const cleanDomain = params.targetDomain.toLowerCase().trim();
    const id = `leg_${params.regulation.toLowerCase()}_${cleanDomain.replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

    return {
      id,
      userId: params.userId,
      targetDomain: cleanDomain,
      serviceName: params.serviceName,
      regulation: params.regulation,
      requestDate,
      initialDeadlineDays: rule.initialDeadlineDays,
      initialDeadlineDate: deadlines.initialDeadlineDate,
      isExtensionClaimed: false,
      extensionDeadlineDays: rule.maxExtensionDays,
      extensionDeadlineDate: undefined,
      status: "SUBMITTED",
      contactEmail: params.contactEmail,
      referenceNumber: params.referenceNumber,
      isStatutoryCommenced: deadlines.isStatutoryEnforceable,
      statutoryCommencementDate: rule.statutoryCommencementDate,
      notes: params.notes,
    };
  }
}
