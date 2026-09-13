import { SECTORS } from "@/lib/finance/types";
import type {
  PortfolioHoldingView,
  Sector,
  SectorSummary,
  ValuationTotals,
} from "@/lib/finance/types";
import { gainLossPct, isFiniteNumber, safeDivide } from "./calculations";

/**
 * Rolls holdings up into valuation totals.
 *
 * Two populations are in play whenever a holding cannot be priced:
 * `totalInvestment` covers all holdings, `totalPresentValue` only the priced
 * ones. Subtracting across them would report every unpriced holding as a total
 * loss, so gain/loss and return both use `pricedInvestment` as their base and
 * `valuationCoveragePct` reports how much of the portfolio that represents.
 */
export function buildTotals(rows: PortfolioHoldingView[]): ValuationTotals {
  let totalInvestment = 0;
  let pricedInvestment = 0;
  let totalPresentValue = 0;
  let pricedHoldingsCount = 0;

  for (const row of rows) {
    totalInvestment += row.investment;

    if (isFiniteNumber(row.presentValue)) {
      pricedInvestment += row.investment;
      totalPresentValue += row.presentValue;
      pricedHoldingsCount += 1;
    }
  }

  const totalGainLoss = pricedHoldingsCount > 0
    ? totalPresentValue - pricedInvestment
    : 0;

  return {
    totalInvestment,
    pricedInvestment,
    totalPresentValue,
    totalGainLoss,
    totalGainLossPct: gainLossPct(totalGainLoss, pricedInvestment) ?? 0,
    pricedHoldingsCount,
    totalHoldingsCount: rows.length,
    valuationCoveragePct: safeDivide(pricedInvestment, totalInvestment) ?? 0,
    completeness: pricedHoldingsCount === rows.length ? "complete" : "partial",
  };
}

/** Sector order follows the workbook rather than being sorted. */
export function buildSectorSummaries(
  rows: PortfolioHoldingView[],
): SectorSummary[] {
  const bySector = new Map<Sector, PortfolioHoldingView[]>();
  for (const sector of SECTORS) bySector.set(sector, []);

  for (const row of rows) {
    bySector.get(row.sector)?.push(row);
  }

  return SECTORS.filter((sector) => (bySector.get(sector)?.length ?? 0) > 0).map(
    (sector) => {
      const holdings = bySector.get(sector) ?? [];
      return { name: sector, holdings, ...buildTotals(holdings) };
    },
  );
}

/** Ranks priced rows only, so an unpriced holding is absent rather than last. */
export function findPerformers(rows: PortfolioHoldingView[]): {
  best: PortfolioHoldingView | null;
  worst: PortfolioHoldingView | null;
} {
  const priced = rows.filter((row) => isFiniteNumber(row.gainLossPct));
  if (priced.length === 0) return { best: null, worst: null };

  let best = priced[0];
  let worst = priced[0];

  for (const row of priced) {
    if ((row.gainLossPct ?? 0) > (best.gainLossPct ?? 0)) best = row;
    if ((row.gainLossPct ?? 0) < (worst.gainLossPct ?? 0)) worst = row;
  }

  return { best, worst };
}
