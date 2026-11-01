import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCache } from "@/lib/cache";
import { RateLimiter } from "@/lib/rateLimit";

describe("MemoryCache", () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>(3, 1000); // max 3 items, 1000ms TTL
  });

  it("sets and retrieves values correctly", () => {
    cache.set("a", "alpha");
    expect(cache.get("a")).toBe("alpha");
    expect(cache.has("a")).toBe(true);
    expect(cache.get("non-existent")).toBeUndefined();
  });

  it("evicts oldest items when maxItems is reached (LRU)", () => {
    cache.set("a", "alpha");
    cache.set("b", "beta");
    cache.set("c", "gamma");

    // Access "a" so it is more recently used
    cache.get("a");

    // Add fourth item, which should evict "b" (since "a" was refreshed and "b" is now oldest)
    cache.set("d", "delta");

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("temp", "value", 500);

    expect(cache.get("temp")).toBe("value");

    vi.advanceTimersByTime(600);

    expect(cache.get("temp")).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("RateLimiter", () => {
  it("enforces max requests within window", () => {
    const limiter = new RateLimiter(3, 10000, 100);

    const r1 = limiter.check("ip-1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("ip-1");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("ip-1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = limiter.check("ip-1");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);

    // Another IP is not blocked
    const other = limiter.check("ip-2");
    expect(other.allowed).toBe(true);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 5000, 100);

    limiter.check("ip-1");
    limiter.check("ip-1");
    expect(limiter.check("ip-1").allowed).toBe(false);

    vi.advanceTimersByTime(5500);

    const afterReset = limiter.check("ip-1");
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
    vi.useRealTimers();
  });
});
