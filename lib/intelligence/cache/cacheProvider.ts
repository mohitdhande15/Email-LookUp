import {
  type ICacheProvider,
  type IRateLimitProvider,
  type RateLimitResult,
} from "./types";

interface CacheRecord<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-Memory Cache Provider with TTL and LRU eviction for local dev & testing.
 */
export class MemoryCacheProvider implements ICacheProvider {
  private store = new Map<string, CacheRecord<unknown>>();
  private maxItems: number;

  constructor(maxItems = 1000) {
    this.maxItems = maxItems;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const record = this.store.get(key);
    if (!record) return null;

    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU position
    this.store.delete(key);
    this.store.set(key, record);
    return record.value as T;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds = 600
  ): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;

    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxItems) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * Sliding Window In-Memory Rate Limiter Provider.
 */
export class MemoryRateLimitProvider implements IRateLimitProvider {
  private records = new Map<string, { count: number; resetAt: number }>();
  private maxKeys: number;

  constructor(maxKeys = 5000) {
    this.maxKeys = maxKeys;
  }

  async check(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entry = this.records.get(key);

    if (!entry || now > entry.resetAt) {
      if (this.records.size >= this.maxKeys) {
        // Evict expired entries
        for (const [k, v] of this.records.entries()) {
          if (now > v.resetAt) this.records.delete(k);
        }
      }

      const resetAt = now + windowMs;
      this.records.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  clear(): void {
    this.records.clear();
  }
}

// Global default singletons for local dev/testing
export const defaultCacheProvider = new MemoryCacheProvider(2000);
export const defaultRateLimitProvider = new MemoryRateLimitProvider(10000);
