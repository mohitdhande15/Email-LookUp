import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/config";
import { defaultPrivacyEngine, type RawEmailPrivacyInput } from "@/lib/intelligence/privacy/privacyEngine";
import { type LegalErasureTrackedRequest } from "@/lib/intelligence/privacy/privacyTypes";

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

  // Read existing legal requests if passed
  let existingLegalRequests: LegalErasureTrackedRequest[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body.legalRequests)) {
      existingLegalRequests = body.legalRequests;
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
          message: "Querying mailbox for marketing lists, tracking pixels, and privacy notices…",
        });

        // Stage 1: Query Gmail for promotions, newsletters, and unsubscribe candidates
        const privacyQuery =
          'subject:("unsubscribe" OR "newsletter" OR "opt out" OR "subscription" OR "privacy policy" OR "terms of service" OR "authorized") OR category:promotions';

        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=80&q=${encodeURIComponent(
          privacyQuery
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
          message: `Found ${messageStubs.length} potential privacy candidates. Auditing headers & tracking telemetry…`,
        });

        // Stage 2: Batch retrieve metadata headers & safe snippets (zero raw body saved)
        const BATCH_SIZE = 20;
        const candidateInputs: RawEmailPrivacyInput[] = [];

        for (let i = 0; i < messageStubs.length; i += BATCH_SIZE) {
          const batch = messageStubs.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.all(
            batch.map(async (stub) => {
              try {
                const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
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
                const listUnsub =
                  headers.find((h) => h.name.toLowerCase() === "list-unsubscribe")?.value;
                const listUnsubPost =
                  headers.find((h) => h.name.toLowerCase() === "list-unsubscribe-post")?.value;
                const snippet = msgData.snippet ?? "";

                // Parse sender email and domain
                const emailMatch = fromHeader.match(/<([^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                const senderEmail = emailMatch ? (emailMatch[1] || emailMatch[2]).toLowerCase() : "";
                const senderDomain = senderEmail.split("@")[1] || "unknown.com";
                const displayName = fromHeader.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || senderDomain;

                return {
                  userId,
                  domain: senderDomain,
                  serviceName: displayName,
                  senderEmail,
                  subject,
                  timestamp: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                  messageId: stub.id,
                  listUnsubscribeHeader: listUnsub,
                  listUnsubscribePostHeader: listUnsubPost,
                  bodySnippetOrHtml: snippet,
                  emailCount: 1,
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
            message: `Inspected ${candidateInputs.length}/${messageStubs.length} message headers…`,
          });
        }

        send({
          type: "progress",
          stage: 3,
          percent: 85,
          message: "Matching California DROP registry, computing cleanup difficulty, and evaluating privacy posture…",
        });

        // Stage 3: Execute Unified Privacy Engine
        const result = await defaultPrivacyEngine.analyzePrivacyFootprint(
          userId,
          candidateInputs,
          existingLegalRequests
        );

        send({
          type: "progress",
          stage: 4,
          percent: 100,
          message: "Privacy Intelligence scan complete.",
        });

        send({
          type: "result",
          analysis: result,
        });

        controller.close();
      } catch (err) {
        send({
          type: "error",
          error: (err as Error).message || "An unexpected error occurred during privacy scan.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
