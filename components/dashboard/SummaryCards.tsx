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
      /* A 40ms stagger: enough to read as a sequence, short enough that the
         whole row has settled before the eye finishes crossing it. Entrance
         runs once on mount and never on a polling refresh. */
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span
        className={`card-rail absolute inset-y-0 left-0 w-[2px] ${railClass}`}
        aria-hidden="true"
      />
      <p className="label-caps text-[0.75rem] leading-none">{label}</p>
      {/* Metric scales with the viewport instead of jumping at a breakpoint. */}
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
