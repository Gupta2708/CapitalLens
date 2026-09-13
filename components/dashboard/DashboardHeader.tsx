"use client";

import { Badge } from "@/components/ui/Badge";
import { formatTime } from "@/lib/format/currency";
import type { PortfolioResponse } from "@/lib/finance/types";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The refresh state is a small pill rather than a spinner over the content, so
 * the data reads as live without anything moving.
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

  // Reports data health, not HTTP health: a provider outage still returns 200,
  // so keying off the request alone would show "Live" above a table of dashes.
  const priceProvider = meta?.providers.yahoo;

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-[3.875rem] max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5 lg:px-8">
        <div className="group flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-lg bg-accent-soft text-accent transition-colors duration-150 group-hover:bg-accent group-hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-6 4 4 5-7" />
              <path d="M3 21h18" />
            </svg>
          </span>
          <div className="leading-tight">
            <h1 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-text-primary">
              CapitalLens
            </h1>
            <p className="text-[0.75rem] text-text-muted">
              Live portfolio &amp; sector performance
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasError ? (
            <Badge tone="loss" title="The most recent refresh failed">
              <span className="live-dot" aria-hidden="true" /> Reconnecting
            </Badge>
          ) : priceProvider === "error" ? (
            <Badge
              tone="warn"
              title="The price provider is not responding. Holdings and cost basis are unaffected."
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              Prices unavailable
            </Badge>
          ) : priceProvider === "partial" ? (
            <Badge tone="warn" title="Some holdings could not be priced">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              Partial
            </Badge>
          ) : !isPolling ? (
            <Badge
              tone="neutral"
              title="Polling is suspended while this tab is in the background"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              Paused
            </Badge>
          ) : (
            <Badge tone="gain" title={`Auto-refreshing every ${intervalSeconds} seconds`}>
              <span className="live-dot" aria-hidden="true" />
              Live
            </Badge>
          )}

          <span className="tnum hidden text-[0.75rem] text-text-muted sm:inline">
            Updated {formatTime(meta?.priceUpdatedAt)}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh now"
            aria-label="Refresh now"
            className="icon-button"
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
              /* Bound to the in-flight state, so clicks cannot stack it. */
              className={isRefreshing ? "icon-spinning" : "icon-rotate"}
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
