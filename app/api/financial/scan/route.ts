import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/config";
import { defaultFinancialEngine } from "@/lib/intelligence/financial/financialEngine";
import { defaultRecommendationEngine } from "@/lib/intelligence/recommendations/recommendationEngine";
import { type RawEmailFinancialInput } from "@/lib/intelligence/financial/transactionExtractor";
import { type CurrencyCode } from "@/lib/intelligence/financial/financialTypes";

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

  let preferredCurrency: CurrencyCode = "USD";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.preferredCurrency === "INR") preferredCurrency = "INR";
    else if (body.preferredCurrency === "EUR") preferredCurrency = "EUR";
    else if (body.preferredCurrency === "GBP") preferredCurrency = "GBP";
  } catch {
    // default to USD
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
          percent: 15,
          message: "Searching mailbox for subscription and payment records…",
        });

        // Stage 1: Targeted financial search query
        const financialQuery =
          'subject:(invoice OR receipt OR subscription OR "free trial" OR "renew" OR "membership" OR "billed" OR "payment received" OR "order confirmation" OR "plan renewed")';

        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(
          financialQuery
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

        if (messageStubs.length === 0) {
          const emptyResult = await defaultFinancialEngine.analyzeTransactions(
            userId,
            [],
            preferredCurrency
          );
          send({
            type: "done",
            summary: emptyResult.summary,
            subscriptions: [],
            trials: [],
            priceAlerts: [],
            findings: [],
            actionPlan: [],
          });
          controller.close();
          return;
        }

        send({
          type: "progress",
          stage: 1,
          percent: 35,
          message: `Found ${messageStubs.length} potential financial emails. Retrieving metadata…`,
        });

        // Batch retrieve metadata and safe snippet (zero raw full body download)
        const BATCH_SIZE = 20;
        const candidateInputs: RawEmailFinancialInput[] = [];

        for (let i = 0; i < messageStubs.length; i += BATCH_SIZE) {
          const batch = messageStubs.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.all(
            batch.map(async (stub) => {
              try {
                // Fetch header metadata and built-in safe snippet
                const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`;
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

                // Parse From email and domain
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

          const currentPercent = Math.min(80, Math.round(35 + (i / messageStubs.length) * 45));
          send({
            type: "progress",
            stage: 2,
            percent: currentPercent,
            message: `Processed ${candidateInputs.length}/${messageStubs.length} financial metadata headers…`,
          });
        }

        send({
          type: "progress",
          stage: 2,
          percent: 85,
          message: "Executing Financial Intelligence Engine: subscriptions, trials & price changes…",
        });

        // Run Financial Engine
        const analysisResult = await defaultFinancialEngine.analyzeTransactions(
          userId,
          candidateInputs,
          preferredCurrency
        );

        // Run Recommendation Engine
        const actionPlan = defaultRecommendationEngine.generateActionPlan(
          analysisResult.findings
        );

        send({
          type: "progress",
          stage: 2,
          percent: 100,
          message: "Financial audit complete.",
        });

        send({
          type: "done",
          summary: analysisResult.summary,
          subscriptions: analysisResult.subscriptions,
          trials: analysisResult.trials,
          priceAlerts: analysisResult.priceAlerts,
          findings: analysisResult.findings,
          actionPlan,
        });

        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Financial scan encountered an error";
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
