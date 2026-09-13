import { describe, expect, it, vi } from "vitest";
import { InFlightRegistry } from "@/lib/cache/inflight";
import { TtlCache } from "@/lib/cache/ttl-cache";

describe("TtlCache", () => {
  it("returns a value while fresh", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 42);
    expect(cache.get("a")).toBe(42);
  });

  it("hides the value once expired", () => {
    vi.useFakeTimers();
    try {
      const cache = new TtlCache<number>(1000);
      cache.set("a", 42);
      vi.advanceTimersByTime(1001);
      expect(cache.get("a")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("still exposes the expired value via getStale", () => {
    // This is what lets a provider failure fall back to the last known price
    // instead of showing nothing -- but only when asked explicitly, so stale
    // data can never be mistaken for live data.
    vi.useFakeTimers();
    try {
      const cache = new TtlCache<number>(1000);
      cache.set("a", 42);
      vi.advanceTimersByTime(5000);

      expect(cache.get("a")).toBeUndefined();
      const stale = cache.getStale("a");
      expect(stale?.value).toBe(42);
      expect(typeof stale?.storedAt).toBe("number");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns undefined for an unknown key", () => {
    expect(new TtlCache<number>(1000).getStale("nope")).toBeUndefined();
  });
});

describe("InFlightRegistry", () => {
  it("collapses concurrent calls for the same key into one run", async () => {
    const registry = new InFlightRegistry<string>();
    let runCount = 0;

    const task = () =>
      new Promise<string>((resolve) => {
        runCount += 1;
        setTimeout(() => resolve("done"), 10);
      });

    // Five callers ask for the same symbol before the first response lands.
    const results = await Promise.all([
      registry.run("SYM", task),
      registry.run("SYM", task),
      registry.run("SYM", task),
      registry.run("SYM", task),
      registry.run("SYM", task),
    ]);

    expect(runCount).toBe(1);
    expect(results).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("keeps different keys independent", async () => {
    const registry = new InFlightRegistry<string>();
    let runCount = 0;
    const task = async () => {
      runCount += 1;
      return "ok";
    };

    await Promise.all([registry.run("A", task), registry.run("B", task)]);
    expect(runCount).toBe(2);
  });

  it("clears the entry after settling so the next call runs fresh", async () => {
    const registry = new InFlightRegistry<string>();
    let runCount = 0;
    const task = async () => {
      runCount += 1;
      return "ok";
    };

    await registry.run("SYM", task);
    expect(registry.size).toBe(0);

    await registry.run("SYM", task);
    expect(runCount).toBe(2);
  });

  it("does not replay a rejection to later callers", async () => {
    const registry = new InFlightRegistry<string>();
    let attempt = 0;

    const flaky = async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("first attempt fails");
      return "recovered";
    };

    await expect(registry.run("SYM", flaky)).rejects.toThrow("first attempt fails");
    await expect(registry.run("SYM", flaky)).resolves.toBe("recovered");
  });
});
