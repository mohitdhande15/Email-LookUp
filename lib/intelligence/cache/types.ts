/**
 * Cache and Rate-Limiter Provider Abstraction Interfaces.
 * Supports in-memory local development and distributed Redis/Upstash backends.
 */

export interface ICacheProvider {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface IRateLimitProvider {
  check(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult>;
}

export type CacheScope = "public" | "user" | "system";

/**
 * Ensures strict cache key isolation so private user findings are never
 * stored under a global or unnamespaced cache key.
 */
export function buildScopedCacheKey(
  scope: "public",
  namespace: string,
  identifier: string
): string;
export function buildScopedCacheKey(
  scope: "user",
  userId: string,
  namespace: string,
  identifier: string
): string;
export function buildScopedCacheKey(
  scope: CacheScope,
  p1: string,
  p2: string,
  p3?: string
): string {
  if (scope === "user") {
    const userId = p1.trim().toLowerCase();
    const namespace = p2.trim().toLowerCase();
    const identifier = (p3 ?? "").trim().toLowerCase();
    return `sec:user:${userId}:${namespace}:${identifier}`;
  }

  const namespace = p1.trim().toLowerCase();
  const identifier = p2.trim().toLowerCase();
  return `sec:public:${namespace}:${identifier}`;
}
