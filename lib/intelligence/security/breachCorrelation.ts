import { type BreachEntry } from "../../sources/breach";
import { type SecurityEvent, type BreachCorrelationResult } from "./securityTypes";

export class BreachCorrelationEngine {
  /**
   * Correlates external breach records with observed mailbox security events.
   * Enforces strict epistemic distinction between historical breach and active compromise.
   */
  static correlateBreaches(
    breaches: BreachEntry[],
    observedEvents: SecurityEvent[],
    userMitigatedBreachNames: Set<string> = new Set()
  ): BreachCorrelationResult[] {
    const results: BreachCorrelationResult[] = [];

    for (const b of breaches) {
      const breachName = b.name;
      const domain = (b as unknown as { domain?: string }).domain || breachName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
      const exposedData = b.xposedData || ["Email addresses"];

      // Calculate historical days
      let historicalDaysAgo: number | undefined = undefined;
      let breachDateObj: Date | undefined = undefined;
      if (b.date) {
        try {
          const d = new Date(b.date);
          if (!isNaN(d.getTime())) {
            breachDateObj = d;
            const diffMs = Date.now() - d.getTime();
            historicalDaysAgo = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          }
        } catch {
          // ignore
        }
      }

      // Check if user has explicitly confirmed credential rotation
      const isRemediationConfirmed = userMitigatedBreachNames.has(breachName.toLowerCase());

      // Find security events occurring after the breach date for this domain
      const subsequentEvents = observedEvents.filter((ev) => {
        const matchesDomain =
          ev.sourceDomain.toLowerCase().includes(domain.toLowerCase()) ||
          ev.serviceName.toLowerCase() === breachName.toLowerCase();

        if (!matchesDomain) return false;

        if (breachDateObj) {
          const evDate = new Date(ev.observedAt);
          return evDate.getTime() >= breachDateObj.getTime();
        }

        return true;
      });

      // Assess whether active compromise is likely:
      // A historical breach ALONE never implies active compromise!
      // Active compromise is only flagged if there are concurrent suspicious sign-ins or failed logins.
      const hasRecentSuspiciousActivity = subsequentEvents.some(
        (ev) => ev.eventType === "SUSPICIOUS_ACTIVITY" || ev.eventType === "UNFAMILIAR_DEVICE_LOGIN"
      );

      const isCurrentCompromiseLikely = hasRecentSuspiciousActivity && !isRemediationConfirmed;

      let riskExplanation = "";
      if (isRemediationConfirmed) {
        riskExplanation = `Remediation confirmed: You marked this breach as remediated. Maintain strong, unique passwords.`;
      } else if (isCurrentCompromiseLikely) {
        riskExplanation = `High Exposure: Historical breach records contain exposed data, and recent suspicious account activity was observed. Immediate credential rotation is advised.`;
      } else if (historicalDaysAgo && historicalDaysAgo > 365 * 3) {
        riskExplanation = `Historical Exposure: This breach occurred ${Math.round(historicalDaysAgo / 365)} years ago. If you rotated your password since then, the risk is mitigated.`;
      } else {
        riskExplanation = `Exposed Credentials: Data leaked in this breach includes ${exposedData.slice(0, 3).join(", ")}. Verify your password is not reused on other platforms.`;
      }

      results.push({
        breachName,
        affectedDomain: domain,
        breachDate: b.date,
        exposedDataClasses: exposedData,
        historicalDaysAgo,
        subsequentSecurityEvents: subsequentEvents,
        isRemediationConfirmed,
        isCurrentCompromiseLikely,
        riskExplanation,
      });
    }

    return results;
  }
}
