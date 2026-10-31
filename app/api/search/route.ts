import type { NextRequest } from "next/server";
import { checkGravatar } from "@/lib/sources/gravatar";
import { checkGitHub } from "@/lib/sources/github";
import { checkBreach } from "@/lib/sources/breach";
import type { SourceResult } from "@/lib/sources/types";

// nodejs is the default runtime (edge is deprecated in Next.js 16)
// No runtime export needed

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321

// ── Simple in-memory rate limiter: 10 req / IP / hour ──────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= RATE_LIMIT_MAX) return false; // blocked
  entry.count++;
  return true;
}

// ── Timeout wrapper ─────────────────────────────────────────────────
function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fn(controller.signal).finally(() => clearTimeout(timer));
}

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse and validate body
  let email: string;
  try {
    const body = await request.json();
    email = (body?.email ?? "").toString().trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return new Response(
      JSON.stringify({ error: "Invalid email address" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build a streaming response with newline-delimited JSON
  const encoder = new TextEncoder();
  const TIMEOUT_MS = 10_000;

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      // Run all three sources in parallel; each has its own 10s timeout
      const tasks: Promise<SourceResult>[] = [
        withTimeout((signal) => checkGravatar(email, signal), TIMEOUT_MS),
        withTimeout((signal) => checkGitHub(email, signal), TIMEOUT_MS),
        withTimeout((signal) => checkBreach(email, signal), TIMEOUT_MS),
      ];

      // Stream results as they settle
      const settled = tasks.map((p) =>
        p
          .then((result) => {
            send(result);
          })
          .catch(() => {
            // Should never happen because source functions catch their own errors
          })
      );

      await Promise.allSettled(settled);
      send({ done: true });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
