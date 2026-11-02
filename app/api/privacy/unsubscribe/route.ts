import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/config";
import { UnsubscribeExecutor } from "@/lib/intelligence/privacy/unsubscribe/unsubscribeExecutor";
import { type UnsubscribeCandidate } from "@/lib/intelligence/privacy/privacyTypes";

export async function POST(req: NextRequest) {
  // 1. Session verification
  const secret = getAuthSecret();
  const token = await getToken({
    req,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required to dispatch unsubscribe requests." },
      { status: 401 }
    );
  }

  // 2. Parse request body
  let body: {
    candidate?: UnsubscribeCandidate;
    confirmedByUser?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request payload." },
      { status: 400 }
    );
  }

  // 3. Explicit User Confirmation Requirement
  if (!body.confirmedByUser) {
    return NextResponse.json(
      {
        error:
          "Unsubscribe execution aborted: explicit human confirmation is strictly required.",
      },
      { status: 400 }
    );
  }

  if (!body.candidate || !body.candidate.mechanism) {
    return NextResponse.json(
      { error: "Missing or malformed unsubscribe candidate record." },
      { status: 400 }
    );
  }

  // 4. Safe Execution with SSRF validation
  try {
    const result = await UnsubscribeExecutor.executeUnsubscribe(body.candidate);
    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        candidateId: body.candidate.id,
        mechanism: body.candidate.mechanism,
        message: `Execution failed: ${(err as Error).message}`,
        timestamp: new Date().toISOString(),
        auditSnippet: `Internal error: ${(err as Error).message}`,
      },
      { status: 500 }
    );
  }
}
