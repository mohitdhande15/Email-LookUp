/**
 * Bounded In-Memory Cache with TTL and LRU Eviction.
 * Prevents memory leaks and reduces unnecessary external API queries.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private maxItems: number;
  private defaultTtlMs: number;

  constructor(maxItems = 1000, defaultTtlMs = 15 * 60 * 1000) {
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh LRU order by re-inserting
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);

    // If key already exists, delete it first to update order
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxItems) {
      // Evict oldest (first key in map iterator)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, { value, expiresAt });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Global shared cache instance for OSINT public lookups (TTL: 10 minutes)
export const osintCache = new MemoryCache<unknown>(500, 10 * 60 * 1000);
