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
  railClass = "bg-border-strong",
  index,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  railClass?: string;
  index: number;
}) {
  return (
    <div
      className="card card-interactive rise-in relative overflow-hidden px-5 py-[1.125rem]"
      /* Runs once on mount, never on a polling refresh. */
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span
        className={`card-rail absolute inset-y-0 left-0 w-[2px] ${railClass}`}
        aria-hidden="true"
      />
      <p className="label-caps text-[0.75rem] leading-none">{label}</p>
      <p className="tnum mt-[0.5rem] text-[clamp(1.5rem,1.28rem+0.78vw,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-text-primary">
        {value}
      </p>
      <p className="mt-[0.3125rem] text-[0.8125rem] leading-tight text-text-secondary">
        {sub}
      </p>
    </div>
  );
}

/**
 * When some holdings could not be priced, the cards say so in their subtitle.
 * A reader must never see a total whose population differs from what they
 * assume it covers.
 */
export function SummaryCards({ summary }: { summary: ValuationTotals }) {
  const isPartial = summary.completeness === "partial";

  // Nothing priced means the figures are unknown, not zero: a confident "0"
  // would read as the portfolio being worthless.
  const hasValuation = summary.pricedHoldingsCount > 0;
  const presentValue = hasValuation ? summary.totalPresentValue : null;
  const gainLoss = hasValuation ? summary.totalGainLoss : null;
  const returnPct = hasValuation ? summary.totalGainLossPct : null;

  const trend = trendOf(gainLoss);
  const performanceRail =
    trend === "up" ? "bg-gain" : trend === "down" ? "bg-loss" : "bg-border-strong";

  const coverageNote = isPartial
    ? `${summary.pricedHoldingsCount} of ${summary.totalHoldingsCount} holdings priced`
    : `All ${summary.totalHoldingsCount} holdings priced`;

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        index={0}
        label="Total Investment"
        railClass="bg-accent"
        value={formatCompactCurrency(summary.totalInvestment)}
        sub={
          <span className="tnum">
            {formatCurrency(summary.totalInvestment)} cost basis
          </span>
        }
      />

      <Card
        index={1}
        label="Current Value"
        railClass="bg-accent"
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
        index={2}
        label="Total Gain / Loss"
        railClass={performanceRail}
        value={<Delta value={gainLoss} format={formatSignedCurrency} />}
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
        index={3}
        label="Total Return"
        railClass={performanceRail}
        value={<Delta value={returnPct} format={formatSignedPercent} />}
        sub={
          <span className="tnum">
            {hasValuation
              ? `on ${formatCurrency(summary.pricedInvestment)} invested`
              : "Awaiting live prices"}
          </span>
        }
      />
    </div>
  );
}
