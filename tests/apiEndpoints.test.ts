import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as searchHandler } from "@/app/api/search/route";
import { POST as declutterHandler } from "@/app/api/declutter/route";
import { consumeNdjsonStream } from "@/lib/ndjsonStream";

describe("API Endpoints Verification", () => {
  describe("POST /api/search", () => {
    it("returns 400 for invalid email addresses", async () => {
      const req = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-not-an-email" }),
      });

      const res = await searchHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("valid email");
    });

    it("returns 400 for non-JSON requests", async () => {
      const req = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });

      const res = await searchHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns streaming NDJSON response with rate limit headers for valid query", async () => {
      const req = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "198.51.100.42",
        },
        body: JSON.stringify({ email: "verified-test@example.com" }),
      });

      const res = await searchHandler(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
      expect(res.headers.has("X-RateLimit-Remaining")).toBe(true);

      // Verify stream can be consumed without throwing
      if (res.body) {
        const items: unknown[] = [];
        await consumeNdjsonStream(res.body, (chunk) => items.push(chunk));
        expect(items.length).toBeGreaterThan(0);
        // Last item has done: true
        const last = items[items.length - 1] as { done?: boolean };
        expect(last.done).toBe(true);
      }
    });
  });

  describe("POST /api/declutter", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/declutter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const res = await declutterHandler(req);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toContain("Please sign in");
    });
  });
});
