"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioResponse } from "@/lib/finance/types";

const DEFAULT_INTERVAL_MS = 15_000;

export interface UsePortfolioState {
  data: PortfolioResponse | null;
  /** True only before the first successful response. */
  isInitialLoading: boolean;
  isRefreshing: boolean;
  /** Set when the most recent attempt failed; previous data stays on screen. */
  error: string | null;
  /** False while the tab is hidden and polling is suspended. */
  isPolling: boolean;
  refresh: () => void;
}

/**
 * Polls /api/portfolio.
 *
 * Requests never overlap -- the next tick is scheduled after the previous one
 * settles rather than on a blind interval, so a slow response cannot stack
 * requests. Polling suspends while the tab is hidden, and previous data
 * survives both refreshes and failures so the table never blanks.
 */
export function usePortfolio(): UsePortfolioState {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Refs, not state: these coordinate the loop and must not trigger renders.
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

      // The server owns the cadence rather than it being hardcoded twice.
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
   * The recursion goes through a ref so the timeout closure cannot capture a
   * stale copy of this callback.
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

    // Next tick, not inline: setting state synchronously inside an effect body
    // cascades a render.
    timeoutRef.current = setTimeout(() => {
      void runRef.current();
    }, 0);

    function handleVisibilityChange() {
      if (document.hidden) {
        clearPendingTimeout();
        setIsPolling(false);
        return;
      }

      // Refresh immediately rather than waiting out the remaining interval.
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
