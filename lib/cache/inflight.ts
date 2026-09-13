/**
 * Keyed in-flight request coalescing.
 *
 * A TTL cache prevents repeat work AFTER a response lands. It does nothing
 * about the window BEFORE the first response arrives: if several requests for
 * the same symbol start within that window, each one misses the cache and each
 * one hits the upstream provider.
 *
 * At a 15-second refresh across 26 symbols that window is hit routinely -- two
 * browser tabs, or a refresh that overlaps a slow response, and Yahoo sees
 * double the traffic. This map guarantees one upstream request per key at a
 * time; every concurrent caller awaits the same promise.
 */
export class InFlightRegistry<T> {
  private readonly pending = new Map<string, Promise<T>>();

  /**
   * Runs `task` for `key`, or joins the run already in progress for that key.
   * The entry is cleared on settle (success or failure) so the next call after
   * completion starts fresh rather than replaying a stale rejection.
   */
  run(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing;

    const promise = task().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /** Number of requests currently in flight. Used by tests. */
  get size(): number {
    return this.pending.size;
  }
}
