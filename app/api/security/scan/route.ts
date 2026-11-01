import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/config";
import { defaultSecurityEngine } from "@/lib/intelligence/security/securityEngine";
import { defaultRiskEngine } from "@/lib/intelligence/risk/riskEngine";
import { defaultRecommendationEngine } from "@/lib/intelligence/recommendations/recommendationEngine";
import { checkBreach, type BreachEntry } from "@/lib/sources/breach";
import { type RawEmailSecurityInput } from "@/lib/intelligence/security/securityEventDetector";

export async function POST(req: NextRequest) {
  const secret = getAuthSecret();
  const token = await getToken({
    req,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token || !token.accessToken || token.error === "RefreshAccessTokenError") {
    return new Response(
      JSON.stringify({
        error: "Google session expired or authorization was revoked. Please sign in again.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const accessToken = token.accessToken as string;
  const userEmail = (token.email as string | undefined)?.toLowerCase() || "user@unknown";
  const userId = token.sub || userEmail;

  // Read user-confirmed mitigations if passed
  let userMitigatedBreaches: Set<string> = new Set();
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body.mitigatedBreaches)) {
      userMitigatedBreaches = new Set(body.mitigatedBreaches.map((b: string) => b.toLowerCase()));
    }
  } catch {
    // ignore
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        send({
          type: "progress",
          stage: 1,
          percent: 10,
          message: "Auditing breach intelligence and querying mailbox for security alerts…",
        });

        // Fetch breach intelligence in parallel
        const breachPromise = checkBreach(userEmail, new AbortController().signal).then((res) => {
          if (res.status === "found" && Array.isArray(res.data?.breaches)) {
            return res.data.breaches as BreachEntry[];
          }
          return [] as BreachEntry[];
        }).catch(() => [] as BreachEntry[]);

        // Stage 1: Search targeted security query
        const securityQuery =
          'subject:("security alert" OR "new sign-in" OR "new login" OR "unrecognized device" OR "password changed" OR "password reset" OR "two-factor" OR "2fa" OR "verification code" OR "recovery email" OR "api key" OR "access token" OR "suspicious activity" OR "suspended" OR "unusual activity")';

        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=80&q=${encodeURIComponent(
          securityQuery
        )}`;

        const listRes = await fetch(listUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (!listRes.ok) {
          if (listRes.status === 401) {
            throw new Error("Google session expired. Please sign out and sign in again.");
          }
          if (listRes.status === 403) {
            throw new Error(
              "Access denied by Google. Please ensure you approved mailbox permissions during sign-in."
            );
          }
          if (listRes.status === 429) {
            throw new Error("Gmail API rate limit reached. Please wait a moment and try again.");
          }
          throw new Error(`Gmail API returned status ${listRes.status}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const listData: any = await listRes.json();
        const messageStubs: Array<{ id: string }> = listData.messages || [];

        send({
          type: "progress",
          stage: 2,
          percent: 30,
          message: `Found ${messageStubs.length} potential security messages. Inspecting headers and snippets…`,
        });

        // Stage 2: Batch retrieve metadata headers & safe snippets (zero body ingestion)
        const BATCH_SIZE = 20;
        const candidateInputs: RawEmailSecurityInput[] = [];

        for (let i = 0; i < messageStubs.length; i += BATCH_SIZE) {
          const batch = messageStubs.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.all(
            batch.map(async (stub) => {
              try {
                const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
                const msgRes = await fetch(msgUrl, {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                  },
                });

                if (!msgRes.ok) return null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msgData: any = await msgRes.json();
                const headers: Array<{ name: string; value: string }> =
                  msgData.payload?.headers ?? [];

                const fromHeader =
                  headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
                const subject =
                  headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
                const dateStr =
                  headers.find((h) => h.name.toLowerCase() === "date")?.value ?? "";
                const snippet = msgData.snippet ?? "";

                // Parse sender email and domain
                const emailMatch = fromHeader.match(/<([^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                const senderEmail = emailMatch ? (emailMatch[1] || emailMatch[2]).toLowerCase() : "";
                const senderDomain = senderEmail.split("@")[1] || "unknown.com";
                const displayName = fromHeader.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();

                return {
                  messageId: stub.id,
                  senderDomain,
                  senderDisplayName: displayName,
                  subject,
                  dateStr,
                  snippet,
                };
              } catch {
                return null;
              }
            })
          );

          for (const item of batchResults) {
            if (item) candidateInputs.push(item);
          }

          const currentPercent = Math.min(80, Math.round(30 + (i / messageStubs.length) * 50));
          send({
            type: "progress",
            stage: 2,
            percent: currentPercent,
            message: `Processed ${candidateInputs.length}/${messageStubs.length} security headers…`,
          });
        }

        const breaches = await breachPromise;

        send({
          type: "progress",
          stage: 3,
          percent: 85,
          message: "Correlating security events, breach exposures & building lockdown checklist…",
        });

        // Run Security Intelligence Engine
        const analysisResult = await defaultSecurityEngine.analyzeSecurityFootprint(
          userId,
          candidateInputs,
          breaches,
          userMitigatedBreaches
        );

        // Run Explainable Risk Engine
        const riskEvaluation = defaultRiskEngine.evaluateFindings(analysisResult.findings);

        // Run Recommendation Engine
        const actionPlan = defaultRecommendationEngine.generateActionPlan(analysisResult.findings);

        send({
          type: "progress",
          stage: 3,
          percent: 100,
          message: "Security audit complete.",
        });

        send({
          type: "done",
          summary: analysisResult.summary,
          events: analysisResult.events,
          breachCorrelations: analysisResult.breachCorrelations,
          lockdownSteps: analysisResult.lockdownSteps,
          riskEvaluation,
          actionPlan,
          findings: analysisResult.findings,
        });

        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Security audit encountered an error";
        send({ type: "error", error: errorMsg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
