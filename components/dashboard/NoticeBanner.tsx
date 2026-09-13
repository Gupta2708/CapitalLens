"use client";

import { formatPercent } from "@/lib/format/currency";
import type { PortfolioResponse } from "@/lib/finance/types";

/**
 * Explains, in plain language, anything the reader should know before trusting
 * the numbers above: unpriced holdings, stale prices, missing fundamentals, a
 * failed refresh.
 *
 * Renders nothing when everything is healthy, so a normal session is not
 * cluttered by a permanently visible status strip.
 */
export function NoticeBanner({
  meta,
  summary,
  error,
}: {
  meta: PortfolioResponse["meta"];
  summary: PortfolioResponse["summary"];
  error: string | null;
}) {
  const notices = [...meta.notices];
  const isPartialValuation = summary.completeness === "partial";

  if (error) {
    notices.unshift(
      `The latest refresh failed (${error}). The figures below are from the last successful update.`,
    );
  }

  if (notices.length === 0) return null;

  // A failed refresh or unpriced holdings affect the headline numbers; missing
  // fundamentals only affect two table columns. Tone reflects that difference.
  const tone = error || isPartialValuation ? "warn" : "neutral";

  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 ${
        tone === "warn"
          ? "border-warn/30 bg-warn-soft"
          : "border-border-subtle bg-surface-raised"
      }`}
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={tone === "warn" ? "text-warn" : "text-text-muted"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.01" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <ul className="space-y-1 text-xs leading-relaxed text-text-secondary">
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>

          {isPartialValuation && (
            <p className="mt-2 text-[0.6875rem] text-text-muted">
              Valuation coverage:{" "}
              <span className="tnum font-medium text-text-secondary">
                {formatPercent(summary.valuationCoveragePct)}
              </span>{" "}
              of cost basis. Gain/loss and return are calculated over priced
              positions only, so they are not diluted by holdings we could not
              value.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
