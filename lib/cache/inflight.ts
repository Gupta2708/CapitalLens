/**
 * Keyed in-flight request coalescing.
 *
 * A TTL cache only helps once a response has landed. Callers that arrive
 * before the first response all miss the cache and all hit the provider, which
 * at a 15-second refresh across 26 symbols happens routinely. This guarantees
 * one upstream request per key at a time.
 */
export class InFlightRegistry<T> {
  private readonly pending = new Map<string, Promise<T>>();

  run(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing;

    // Cleared on settle so the next call starts fresh rather than replaying
    // a stale rejection.
    const promise = task().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  get size(): number {
    return this.pending.size;
  }
}
