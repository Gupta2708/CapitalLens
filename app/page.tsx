"use client";

import { useMemo } from "react";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { NoticeBanner } from "@/components/dashboard/NoticeBanner";
import { PerformerCards } from "@/components/dashboard/PerformerCards";
import { PortfolioTable } from "@/components/dashboard/PortfolioTable";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { usePortfolio } from "@/hooks/usePortfolio";
import { findPerformers } from "@/lib/portfolio/aggregate";
import { formatTime } from "@/lib/format/currency";

export default function DashboardPage() {
  const { data, isInitialLoading, isRefreshing, error, isPolling, refresh } =
    usePortfolio();

  const performers = useMemo(
    () => findPerformers(data?.holdings ?? []),
    [data?.holdings],
  );

  return (
    <>
      <DashboardHeader
        meta={data?.meta ?? null}
        isRefreshing={isRefreshing}
        isPolling={isPolling}
        hasError={error !== null}
        onRefresh={refresh}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-5 lg:px-8">
        {/* Skeletons only before the first response; later refreshes update
            the live table in place. */}
        {isInitialLoading ? (
          <DashboardSkeleton />
        ) : !data ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : (
          <div className="space-y-4">
            <SummaryCards summary={data.summary} />

            <NoticeBanner meta={data.meta} summary={data.summary} error={error} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AllocationChart sectors={data.sectors} />
              </div>
              <PerformerCards best={performers.best} worst={performers.worst} />
            </div>

            <PortfolioTable
              sectors={data.sectors}
              totalHoldings={data.holdings.length}
            />

            <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-4 pt-1 text-[0.75rem] text-text-muted">
              <span className="tnum">
                Prices updated {formatTime(data.meta.priceUpdatedAt)}
              </span>
              <span className="tnum">
                Fundamentals updated {formatTime(data.meta.fundamentalsUpdatedAt)}
              </span>
              <span>
                Refreshing every {Math.round(data.meta.refreshIntervalMs / 1000)}s
              </span>
              <span className="ml-auto">
                Holdings are a fixed snapshot from the source workbook.
              </span>
            </footer>
          </div>
        )}
      </main>
    </>
  );
}

/** Only when the first request fails and there is nothing to show. */
function ErrorState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-loss-soft text-loss"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      </span>
      <h2 className="mt-4 text-sm font-semibold text-text-primary">
        Could not load the portfolio
      </h2>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-secondary">
        {error ?? "The portfolio service did not respond."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="icon-button mt-5 h-auto w-auto border-transparent bg-accent px-4 py-2 text-[0.8125rem] font-medium text-white hover:bg-accent hover:text-white"
      >
        Try again
      </button>
    </div>
  );
}
