import { describe, it, expect } from "vitest";
import {
  buildScopedCacheKey,
} from "@/lib/intelligence/cache/types";
import {
  MemoryCacheProvider,
  MemoryRateLimitProvider,
} from "@/lib/intelligence/cache/cacheProvider";

describe("Cache & Rate-Limit Abstraction", () => {
  it("enforces scoped cache keys to isolate user data from public data", () => {
    const publicKey = buildScopedCacheKey("public", "osint", "alice@example.com");
    const userKey = buildScopedCacheKey(
      "user",
      "usr_123",
      "mailbox",
      "messages_page_1"
    );

    expect(publicKey).toBe("sec:public:osint:alice@example.com");
    expect(userKey).toBe("sec:user:usr_123:mailbox:messages_page_1");
    expect(publicKey).not.toContain("usr_123");
  });

  it("handles get, set, delete, and expiration in MemoryCacheProvider", async () => {
    const cache = new MemoryCacheProvider(10);
    await cache.set("test_key", { data: 42 }, 1); // 1 sec TTL

    const value = await cache.get<{ data: number }>("test_key");
    expect(value?.data).toBe(42);

    const deleted = await cache.delete("test_key");
    expect(deleted).toBe(true);

    const afterDelete = await cache.get("test_key");
    expect(afterDelete).toBeNull();
  });

  it("enforces rate limits per key in MemoryRateLimitProvider", async () => {
    const limiter = new MemoryRateLimitProvider(100);

    const r1 = await limiter.check("ip:127.0.0.1", 2, 60);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = await limiter.check("ip:127.0.0.1", 2, 60);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = await limiter.check("ip:127.0.0.1", 2, 60);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);

    // Another IP is not blocked
    const other = await limiter.check("ip:192.168.1.1", 2, 60);
    expect(other.allowed).toBe(true);
  });
});
