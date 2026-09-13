"use client";

import { Badge } from "@/components/ui/Badge";
import { formatTime } from "@/lib/format/currency";
import type { PortfolioResponse } from "@/lib/finance/types";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Sticky top bar: identity on the left, data state on the right.
 *
 * The refresh state is intentionally a small quiet pill rather than a spinner
 * over the content -- the reader should be able to tell the data is live
 * without anything moving in their field of view.
 */
export function DashboardHeader({
  meta,
  isRefreshing,
  isPolling,
  hasError,
  onRefresh,
}: {
  meta: PortfolioResponse["meta"] | null;
  isRefreshing: boolean;
  isPolling: boolean;
  hasError: boolean;
  onRefresh: () => void;
}) {
  const intervalSeconds = Math.round((meta?.refreshIntervalMs ?? 15_000) / 1000);

  /*
   * The pill reports DATA health, not just HTTP health. A provider outage still
   * returns 200 with the static portfolio intact, so keying this off the request
   * alone would keep showing a confident "Live" while every price on screen is
   * an em-dash.
   */
  const priceProvider = meta?.providers.yahoo;

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-6 4 4 5-7" />
              <path d="M3 21h18" />
            </svg>
          </span>
          <div className="leading-tight">
            <h1 className="text-[0.9375rem] font-semibold tracking-tight text-text-primary">
              CapitalLens
            </h1>
            <p className="text-[0.6875rem] text-text-muted">
              Live portfolio &amp; sector performance
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Live-state pill. Three distinct states, never ambiguous. */}
          {hasError ? (
            <Badge tone="loss" title="The most recent refresh failed">
              <span aria-hidden="true">{"●"}</span> Reconnecting
            </Badge>
          ) : priceProvider === "error" ? (
            <Badge tone="warn" title="The price provider is not responding. Holdings and cost basis are unaffected.">
              <span aria-hidden="true">{"●"}</span> Prices unavailable
            </Badge>
          ) : priceProvider === "partial" ? (
            <Badge tone="warn" title="Some holdings could not be priced">
              <span aria-hidden="true">{"●"}</span> Partial
            </Badge>
          ) : !isPolling ? (
            <Badge tone="neutral" title="Polling is suspended while this tab is in the background">
              <span aria-hidden="true">{"●"}</span> Paused
            </Badge>
          ) : (
            <Badge tone="gain" title={`Auto-refreshing every ${intervalSeconds} seconds`}>
              <span aria-hidden="true" className={isRefreshing ? "pulse-dot" : ""}>
                {"●"}
              </span>
              {isRefreshing ? "Updating" : "Live"}
            </Badge>
          )}

          <span className="hidden text-[0.6875rem] text-text-muted sm:inline tnum">
            Updated {formatTime(meta?.priceUpdatedAt)}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh now"
            aria-label="Refresh now"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-overlay text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? "animate-spin" : ""}
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
