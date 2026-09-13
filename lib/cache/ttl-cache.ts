/**
 * A tiny in-memory TTL cache.
 *
 * The one feature that matters beyond a plain Map: expired entries are RETAINED
 * and readable via `getStale`. When a provider call fails we would rather show
 * the last known price clearly labelled as stale than show nothing at all --
 * but the caller has to ask for it explicitly, so stale data can never be
 * mistaken for live data.
 *
 * Limitation, documented in TECHNICAL_NOTES.md: this lives in process memory.
 * On serverless it is per-instance and resets on cold start. Redis would be the
 * production answer; it is deliberately not introduced for this assignment.
 */
export interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  /** Returns the value only while fresh. Expired entries yield undefined. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    return entry.value;
  }

  /**
   * Returns the last known value regardless of age, with its timestamp, so the
   * caller can mark it stale. Used only on the provider-failure path.
   */
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

  /** Test helper; not used by application code. */
  clear(): void {
    this.store.clear();
  }
}
