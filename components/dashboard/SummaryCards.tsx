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
  const trend = trendOf(summary.totalGainLoss);

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
        value={formatCompactCurrency(summary.totalPresentValue)}
        sub={
          isPartial ? (
            <span className="text-warn">{coverageNote}</span>
          ) : (
            <span className="tnum">{formatCurrency(summary.totalPresentValue)}</span>
          )
        }
      />

      <Card
        label="Total Gain / Loss"
        accentClass={trend === "up" ? "bg-gain" : trend === "down" ? "bg-loss" : "bg-border-strong"}
        value={
          <Delta value={summary.totalGainLoss} format={formatSignedCurrency} />
        }
        sub={
          <span>
            {isPartial ? "On priced positions only" : "Against full cost basis"}
          </span>
        }
      />

      <Card
        label="Total Return"
        accentClass={trend === "up" ? "bg-gain" : trend === "down" ? "bg-loss" : "bg-border-strong"}
        value={
          <Delta value={summary.totalGainLossPct} format={formatSignedPercent} />
        }
        sub={
          <span className="tnum">
            {/* Naming the denominator is the point: it is the priced basis. */}
            on {formatCurrency(summary.pricedInvestment)} invested
          </span>
        }
      />
    </div>
  );
}
