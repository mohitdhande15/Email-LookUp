import type { NextRequest } from "next/server";
import { checkGravatar } from "@/lib/sources/gravatar";
import { checkGitHub } from "@/lib/sources/github";
import { checkBreach } from "@/lib/sources/breach";
import type { SourceResult } from "@/lib/sources/types";
import { searchRateLimiter } from "@/lib/rateLimit";
import { osintCache } from "@/lib/cache";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const SOURCE_TIMEOUT_MS = 10_000;

function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fn(controller.signal)
    .catch(() => fallback)
    .finally(() => clearTimeout(timer));
}

export async function POST(request: NextRequest) {
  // Rate limit by client IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const rateLimitStatus = searchRateLimiter.check(ip);

  if (!rateLimitStatus.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please wait before running another query.",
        resetAt: new Date(rateLimitStatus.resetAt).toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(rateLimitStatus.resetAt / 1000)),
          "Retry-After": String(
            Math.max(1, Math.ceil((rateLimitStatus.resetAt - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  // Parse and validate email
  let email: string;
  try {
    const body = await request.json();
    email = (body?.email ?? "").toString().trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return new Response(
      JSON.stringify({ error: "Please enter a valid email address." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  // Check cache first
  const cacheKey = `osint:${email}`;
  const cachedResults = osintCache.get(cacheKey) as SourceResult[] | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      if (cachedResults && Array.isArray(cachedResults)) {
        for (const res of cachedResults) {
          send(res);
        }
        send({ done: true, fromCache: true });
        controller.close();
        return;
      }

      const accumulatedResults: SourceResult[] = [];

      // Run sources in parallel with independent timeouts
      const tasks: Promise<SourceResult>[] = [
        withTimeout<SourceResult>(
          (signal) => checkGravatar(email, signal),
          SOURCE_TIMEOUT_MS,
          { source: "gravatar", status: "error", message: "Timeout" }
        ),
        withTimeout<SourceResult>(
          (signal) => checkGitHub(email, signal),
          SOURCE_TIMEOUT_MS,
          { source: "github", status: "error", message: "Timeout" }
        ),
        withTimeout<SourceResult>(
          (signal) => checkBreach(email, signal),
          SOURCE_TIMEOUT_MS,
          { source: "breach", status: "error", message: "Timeout" }
        ),
      ];

      const settled = tasks.map((p) =>
        p.then((result) => {
          accumulatedResults.push(result);
          send(result);
        })
      );

      await Promise.allSettled(settled);

      // Cache accumulated results for 10 minutes
      if (accumulatedResults.length > 0) {
        osintCache.set(cacheKey, accumulatedResults, 10 * 60 * 1000);
      }

      send({ done: true });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-RateLimit-Remaining": String(rateLimitStatus.remaining),
    },
  });
}
