import {
  type UnsubscribeCandidate,
  type UnsubscribeExecutionResult,
} from "../privacyTypes";
import { UnsubscribeSecurity } from "./unsubscribeSecurity";

export interface ExecutionOptions {
  fetchImpl?: typeof fetch;
  dnsResolver?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  timeoutMs?: number;
}

export class UnsubscribeExecutor {
  /**
   * Dispatches RFC 8058 POST or formats Mailto action.
   * Requires explicit user confirmation flag.
   */
  static async executeUnsubscribe(
    candidate: UnsubscribeCandidate,
    options: ExecutionOptions = {}
  ): Promise<UnsubscribeExecutionResult> {
    const timestamp = new Date().toISOString();
    const fetcher = options.fetchImpl ?? fetch;
    const timeoutMs = options.timeoutMs ?? 8000;

    if (candidate.mechanism === "RFC_8058_POST") {
      if (!candidate.targetUrl) {
        return {
          candidateId: candidate.id,
          success: false,
          mechanism: candidate.mechanism,
          message: "RFC 8058 execution aborted: target URL is missing",
          timestamp,
          auditSnippet: "Target URL missing in candidate record",
        };
      }

      // 1. SSRF and DNS check
      const validation = await UnsubscribeSecurity.validateUrlForOutboundRequest(
        candidate.targetUrl,
        { dnsResolver: options.dnsResolver }
      );

      if (!validation.isValid || !validation.sanitizedUrl) {
        return {
          candidateId: candidate.id,
          success: false,
          mechanism: candidate.mechanism,
          message: `SSRF Security Policy Rejection: ${validation.errorReason}`,
          timestamp,
          auditSnippet: `Blocked outbound request to ${candidate.targetUrl} - Reason: ${validation.errorReason}`,
        };
      }

      // 2. Execute POST with List-Unsubscribe=One-Click body
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        let currentUrl = validation.sanitizedUrl;
        let redirectHops = 0;
        const maxHops = 3;
        let response: Response | null = null;

        while (redirectHops <= maxHops) {
          response = await fetcher(currentUrl, {
            method: "POST",
            headers: UnsubscribeSecurity.getSecureOutboundHeaders(),
            body: "List-Unsubscribe=One-Click",
            signal: controller.signal,
            redirect: "manual", // Handle redirects explicitly to re-verify SSRF
          });

          // Check if redirect
          if (
            [301, 302, 303, 307, 308].includes(response.status) &&
            response.headers.get("location")
          ) {
            redirectHops++;
            if (redirectHops > maxHops) {
              clearTimeout(timeout);
              return {
                candidateId: candidate.id,
                success: false,
                mechanism: candidate.mechanism,
                httpStatus: response.status,
                message: "Exceeded maximum allowed redirects (3 hops)",
                timestamp,
                auditSnippet: `Redirect limit exceeded from ${candidate.targetUrl}`,
              };
            }

            const rawLocation = response.headers.get("location")!;
            const nextUrl = new URL(rawLocation, currentUrl).toString();

            // Re-validate redirect target through SSRF validator
            const redirectValidation =
              await UnsubscribeSecurity.validateUrlForOutboundRequest(nextUrl, {
                dnsResolver: options.dnsResolver,
              });

            if (!redirectValidation.isValid || !redirectValidation.sanitizedUrl) {
              clearTimeout(timeout);
              return {
                candidateId: candidate.id,
                success: false,
                mechanism: candidate.mechanism,
                httpStatus: response.status,
                message: `Redirect target rejected by SSRF Policy: ${redirectValidation.errorReason}`,
                timestamp,
                auditSnippet: `Blocked redirect hop to ${nextUrl}: ${redirectValidation.errorReason}`,
              };
            }

            currentUrl = redirectValidation.sanitizedUrl;
            continue;
          }

          break;
        }

        clearTimeout(timeout);

        if (!response) {
          throw new Error("No response received from target server");
        }

        const isSuccess = response.status >= 200 && response.status < 300;

        return {
          candidateId: candidate.id,
          success: isSuccess,
          mechanism: candidate.mechanism,
          httpStatus: response.status,
          message: isSuccess
            ? `Successfully unsubscribed via RFC 8058 POST (HTTP ${response.status})`
            : `Unsubscribe POST returned status code HTTP ${response.status}`,
          timestamp,
          auditSnippet: `RFC 8058 POST -> ${currentUrl} returned HTTP ${response.status}`,
        };
      } catch (err) {
        return {
          candidateId: candidate.id,
          success: false,
          mechanism: candidate.mechanism,
          message: `Network error during RFC 8058 execution: ${(err as Error).message}`,
          timestamp,
          auditSnippet: `Network error: ${(err as Error).message}`,
        };
      }
    }

    if (candidate.mechanism === "MAILTO") {
      if (!candidate.mailtoAddress) {
        return {
          candidateId: candidate.id,
          success: false,
          mechanism: candidate.mechanism,
          message: "Mailto unsubscribe address is missing",
          timestamp,
          auditSnippet: "Mailto address missing",
        };
      }

      const encodedSubject = encodeURIComponent(candidate.mailSubject ?? "Unsubscribe");
      const encodedBody = encodeURIComponent(
        `Please unsubscribe ${candidate.senderEmail || "my address"} from this mailing list.\n\nGenerated by Email-LookUp Privacy Engine.`
      );
      const mailtoUrl = `mailto:${candidate.mailtoAddress}?subject=${encodedSubject}&body=${encodedBody}`;

      return {
        candidateId: candidate.id,
        success: true,
        mechanism: candidate.mechanism,
        message: `Mailto handler prepared for ${candidate.mailtoAddress}`,
        timestamp,
        auditSnippet: `Mailto intent generated: ${mailtoUrl.slice(0, 80)}...`,
      };
    }

    if (candidate.mechanism === "WEB_FORM") {
      return {
        candidateId: candidate.id,
        success: false,
        mechanism: candidate.mechanism,
        message: "Automated web form submission is not permitted; open link manually to unsubscribe",
        timestamp,
        auditSnippet: `Web form URL available: ${candidate.targetUrl ?? "None"}`,
      };
    }

    return {
      candidateId: candidate.id,
      success: false,
      mechanism: candidate.mechanism,
      message: "No standard unsubscribe mechanism available for this sender",
      timestamp,
      auditSnippet: "No RFC 8058 or Mailto header detected",
    };
  }
}
