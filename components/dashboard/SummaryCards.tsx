"use client";

import { Delta } from "@/components/ui/Delta";
import {
  formatCompactCurrency,
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
  trendOf,
} from "@/lib/format/currency";
import type { ValuationTotals } from "@/lib/finance/types";

function Card({
  label,
  value,
  sub,
  accentClass = "",
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accentClass?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      {/* 2px accent rail: colour-codes the card without tinting the whole surface. */}
      <span className={`absolute inset-y-0 left-0 w-[2px] ${accentClass}`} aria-hidden="true" />
      <p className="label-caps">{label}</p>
      <p className="tnum mt-2.5 text-[1.75rem] font-semibold leading-none tracking-tight text-text-primary">
        {value}
      </p>
      <p className="mt-2.5 text-xs text-text-secondary">{sub}</p>
    </div>
  );
}

/**
 * The four headline figures.
 *
 * When some holdings could not be priced, the current-value and return cards
 * say so directly in their subtitle. A reader must never see a total whose
 * population differs from what they assume.
 */
export function SummaryCards({ summary }: { summary: ValuationTotals }) {
  const isPartial = summary.completeness === "partial";

  /*
   * With nothing priced, every valuation figure is genuinely unknown -- not
   * zero. Showing a confident "0" would read as "your portfolio is worth
   * nothing", so these fall back to an em-dash instead.
   */
  const hasValuation = summary.pricedHoldingsCount > 0;
  const presentValue = hasValuation ? summary.totalPresentValue : null;
  const gainLoss = hasValuation ? summary.totalGainLoss : null;
  const returnPct = hasValuation ? summary.totalGainLossPct : null;

  const trend = trendOf(gainLoss);

  const coverageNote = isPartial
    ? `${summary.pricedHoldingsCount} of ${summary.totalHoldingsCount} holdings priced`
    : `All ${summary.totalHoldingsCount} holdings priced`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="Total Investment"
        accentClass="bg-accent"
        value={formatCompactCurrency(summary.totalInvestment)}
        sub={
          <span className="tnum">
            {formatCurrency(summary.totalInvestment)} cost basis
          </span>
        }
      />

      <Card
        label="Current Value"
        accentClass="bg-accent"
        value={formatCompactCurrency(presentValue)}
        sub={
          isPartial ? (
            <span className="text-warn">{coverageNote}</span>
          ) : (
            <span className="tnum">{formatCurrency(presentValue)}</span>
          )
        }
      />

      <Card
        label="Total Gain / Loss"
        accentClass={trend === "up" ? "bg-gain" : trend === "down" ? "bg-loss" : "bg-border-strong"}
        value={
          <Delta value={gainLoss} format={formatSignedCurrency} />
        }
        sub={
          <span>
            {!hasValuation
              ? "No live prices available"
              : isPartial
                ? "On priced positions only"
                : "Against full cost basis"}
          </span>
        }
      />

      <Card
        label="Total Return"
        accentClass={trend === "up" ? "bg-gain" : trend === "down" ? "bg-loss" : "bg-border-strong"}
        value={
          <Delta value={returnPct} format={formatSignedPercent} />
        }
        sub={
          <span className="tnum">
            {/* Naming the denominator is the point: it is the priced basis. */}
            {hasValuation
              ? `on ${formatCurrency(summary.pricedInvestment)} invested`
              : "Awaiting live prices"}
          </span>
        }
      />
    </div>
  );
}
