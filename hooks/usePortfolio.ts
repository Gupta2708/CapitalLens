"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioResponse } from "@/lib/finance/types";

const DEFAULT_INTERVAL_MS = 15_000;

export interface UsePortfolioState {
  data: PortfolioResponse | null;
  /** True only before the first successful response. Drives the skeleton. */
  isInitialLoading: boolean;
  /** True during a background refresh, while `data` still holds the last result. */
  isRefreshing: boolean;
  /** Set when the most recent attempt failed. Previous data is kept on screen. */
  error: string | null;
  /** False while the tab is hidden and polling is suspended. */
  isPolling: boolean;
  refresh: () => void;
}

/**
 * Polls /api/portfolio on a fixed cadence.
 *
 * Three behaviours here are deliberate and worth knowing:
 *
 * 1. Requests never overlap. The next tick is scheduled AFTER the previous
 *    response settles, not by a blind setInterval. A slow 20-second response on
 *    a 15-second interval would otherwise stack requests indefinitely and
 *    multiply load on the upstream providers.
 *
 * 2. Polling suspends while the tab is hidden and resumes with an immediate
 *    refresh on return. A backgrounded tab left open overnight issues no
 *    requests at all.
 *
 * 3. Previous data survives both refreshes and failures. The table is never
 *    unmounted mid-session, so values update in place with no layout shift and
 *    a transient network blip does not blank the dashboard.
 */
export function usePortfolio(): UsePortfolioState {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Refs rather than state: these coordinate the loop and must never trigger
  // a re-render or be captured stale inside the timeout closure.
  const inFlightRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef(DEFAULT_INTERVAL_MS);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    // Guard 1: never start a second request while one is in flight.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    if (mountedRef.current) setIsRefreshing(true);

    try {
      const response = await fetch("/api/portfolio", {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PortfolioResponse;
      if (!mountedRef.current) return;

      setData(payload);
      setError(null);

      // Let the server dictate the cadence rather than hardcoding it twice.
      if (typeof payload.meta?.refreshIntervalMs === "number") {
        intervalRef.current = payload.meta.refreshIntervalMs;
      }
    } catch (caught) {
      // An abort is our own cleanup, not a failure worth showing.
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (!mountedRef.current) return;

      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsRefreshing(false);
        setIsInitialLoading(false);
      }
    }
  }, []);

  /**
   * Runs one fetch, then schedules the next relative to its COMPLETION.
   *
   * The recursion goes through a ref rather than referencing the callback
   * directly: the timeout closure would otherwise capture the identity of the
   * function at schedule time, which is exactly the stale-closure bug that
   * makes long-lived polling loops stop responding to changes.
   */
  const runRef = useRef<() => Promise<void>>(async () => {});

  const runAndSchedule = useCallback(async () => {
    await fetchPortfolio();
    if (!mountedRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => {
      void runRef.current();
    }, intervalRef.current);
  }, [fetchPortfolio, clearPendingTimeout]);

  useEffect(() => {
    mountedRef.current = true;
    runRef.current = runAndSchedule;

    // Kick off on the next tick rather than inline. Calling it synchronously in
    // the effect body would set state during the effect and cascade a render.
    timeoutRef.current = setTimeout(() => {
      void runRef.current();
    }, 0);

    function handleVisibilityChange() {
      if (document.hidden) {
        // Suspend: cancel the pending tick and let any in-flight request finish.
        clearPendingTimeout();
        setIsPolling(false);
        return;
      }

      // Resume with an immediate refresh so the reader never looks at a stale
      // figure while waiting out the remainder of an interval.
      setIsPolling(true);
      void runAndSchedule();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearPendingTimeout();
      abortRef.current?.abort();
    };
  }, [runAndSchedule, clearPendingTimeout]);

  const refresh = useCallback(() => {
    clearPendingTimeout();
    void runAndSchedule();
  }, [runAndSchedule, clearPendingTimeout]);

  return { data, isInitialLoading, isRefreshing, error, isPolling, refresh };
}
