/**
 * In-memory TTL cache. Expired entries are retained and readable via
 * `getStale` so a failed provider call can fall back to the last known value
 * and label it, rather than showing nothing.
 *
 * On serverless this is per-instance and resets on cold start.
 */
export interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    return entry.value;
  }

  /** Last known value regardless of age, with its timestamp. */
  getStale(key: string): CacheEntry<T> | undefined {
    return this.store.get(key);
  }

  set(key: string, value: T): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      storedAt: now,
      expiresAt: now + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}
