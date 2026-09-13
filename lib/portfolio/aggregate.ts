import { SECTORS } from "@/lib/finance/types";
import type {
  PortfolioHoldingView,
  Sector,
  SectorSummary,
  ValuationTotals,
} from "@/lib/finance/types";
import { gainLossPct, isFiniteNumber, safeDivide } from "./calculations";

/**
 * Rolls a set of holding rows up into valuation totals.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------
 * When some holdings cannot be priced, there are two different populations in
 * play and they must never be mixed:
 *
 *   all holdings    -> totalInvestment   (the full cost basis)
 *   priced holdings -> totalPresentValue (what we can actually value today)
 *
 * Computing `totalPresentValue - totalInvestment` across those two populations
 * silently reports the unpriced positions as a total loss. With 2 of 26
 * holdings unpriced, that understates the portfolio by their entire cost basis.
 *
 * So gain/loss subtracts `pricedInvestment`, and the return percentage divides
 * by `pricedInvestment`. `valuationCoveragePct` and `completeness` then tell the
 * UI how much of the portfolio those figures actually describe.
 */
export function buildTotals(rows: PortfolioHoldingView[]): ValuationTotals {
  let totalInvestment = 0;
  let pricedInvestment = 0;
  let totalPresentValue = 0;
  let pricedHoldingsCount = 0;

  for (const row of rows) {
    totalInvestment += row.investment;

    // A row counts as priced only if it produced a usable present value.
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
    // Denominator is the priced basis, never the full basis.
    totalGainLossPct: gainLossPct(totalGainLoss, pricedInvestment) ?? 0,
    pricedHoldingsCount,
    totalHoldingsCount: rows.length,
    valuationCoveragePct: safeDivide(pricedInvestment, totalInvestment) ?? 0,
    completeness: pricedHoldingsCount === rows.length ? "complete" : "partial",
  };
}

/**
 * Groups rows into the six workbook sectors, each with its own totals computed
 * under the same priced-subset rule. Sector order follows the workbook rather
 * than being sorted, so the dashboard reads like the source document.
 */
export function buildSectorSummaries(
  rows: PortfolioHoldingView[],
): SectorSummary[] {
  const bySector = new Map<Sector, PortfolioHoldingView[]>();
  for (const sector of SECTORS) bySector.set(sector, []);

  for (const row of rows) {
    // `?? []` keeps an unexpected sector value from throwing; SECTORS is the
    // source of truth and a stray row would simply be dropped from grouping.
    bySector.get(row.sector)?.push(row);
  }

  return SECTORS.filter((sector) => (bySector.get(sector)?.length ?? 0) > 0).map(
    (sector) => {
      const holdings = bySector.get(sector) ?? [];
      return { name: sector, holdings, ...buildTotals(holdings) };
    },
  );
}

/**
 * Best and worst performers by return percentage, considering priced rows only.
 * Returns nulls when fewer than one row can be valued.
 */
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
