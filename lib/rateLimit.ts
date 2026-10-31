/**
 * Bounded Rate Limiter with automatic TTL cleanup and sliding windows.
 * Prevents denial of service and memory leaks.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private maxEntries: number;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 10, windowMs = 60 * 60 * 1000, maxEntries = 5000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Check if a key (e.g. client IP) is allowed under the rate limit.
   * Returns { allowed: boolean, remaining: number, resetAt: number }.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = this.records.get(key);

    // Evict expired entry or initialize
    if (!record || now > record.resetAt) {
      if (this.records.size >= this.maxEntries) {
        this.cleanupExpired(now);
        // If still full, drop oldest
        if (this.records.size >= this.maxEntries) {
          const oldest = this.records.keys().next().value;
          if (oldest) this.records.delete(oldest);
        }
      }

      const resetAt = now + this.windowMs;
      this.records.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    if (record.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    record.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetAt: record.resetAt,
    };
  }

  private cleanupExpired(now: number): void {
    for (const [k, v] of this.records.entries()) {
      if (now > v.resetAt) {
        this.records.delete(k);
      }
    }
  }

  clear(): void {
    this.records.clear();
  }

  get size(): number {
    return this.records.size;
  }
}

// Global rate limiter for public search: 30 requests / IP / hour, max 5000 tracked IPs
export const searchRateLimiter = new RateLimiter(30, 60 * 60 * 1000, 5000);
