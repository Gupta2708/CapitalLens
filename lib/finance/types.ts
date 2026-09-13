/**
 * `source*` fields are what the workbook said; `price*` fields are where the
 * live quote actually came from. They are kept apart so a BSE-coded holding
 * priced on NSE never implies the quote came from BSE.
 */

export type Exchange = "NSE" | "BSE";

export const SECTORS = [
  "Financial Sector",
  "Tech Sector",
  "Consumer",
  "Power",
  "Pipe Sector",
  "Others",
] as const;

export type Sector = (typeof SECTORS)[number];

export interface Holding {
  id: string;
  name: string;
  sector: Sector;

  /** Cost basis exactly as supplied by the workbook; never adjusted. */
  purchasePrice: number;
  quantity: number;

  /** Verbatim `NSE/BSE` cell from the sheet, e.g. "532174" or "HDFCBANK". */
  sourceExchangeCode: string;
  sourceExchange: Exchange;

  /** Yahoo symbol, e.g. "ICICIBANK.BO". */
  priceSymbol: string;
  priceExchange: Exchange;
  /** Used only if `priceSymbol` fails. */
  fallbackPriceSymbol: string | null;
  fallbackPriceExchange: Exchange | null;

  /** Google Finance symbol, e.g. "532174:BOM". */
  googleSymbol: string | null;
}

/** `stale` means a cached value past its TTL. */
export type DataFreshness = "live" | "stale" | "unavailable";

export interface QuoteResult {
  symbol: string;
  exchange: Exchange | null;
  price: number | null;
  currency: string | null;
  fetchedAt: string;
  source: "yahoo";
  freshness: DataFreshness;
  error?: string;
}

export interface FundamentalsResult {
  symbol: string;
  peRatio: number | null;
  /** The workbook's "Latest Earnings" column is Google Finance's EPS. */
  latestEarningsEps: number | null;
  fetchedAt: string;
  source: "google-finance";
  freshness: DataFreshness;
  error?: string;
}

export type ProviderStatus = "ok" | "partial" | "error";

export interface PortfolioHoldingView {
  id: string;
  name: string;
  sector: Sector;

  purchasePrice: number;
  quantity: number;
  investment: number;
  portfolioPct: number;

  sourceExchangeCode: string;
  sourceExchange: Exchange;

  cmp: number | null;
  presentValue: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;

  peRatio: number | null;
  latestEarningsEps: number | null;

  /** Null when unpriced. */
  pricedOn: Exchange | null;
  pricedOnFallbackExchange: boolean;

  quoteFreshness: DataFreshness;
  fundamentalsFreshness: DataFreshness;
  quotedAt: string | null;
}

/** Totals are computed over the priced subset only; see `aggregate.ts`. */
export interface ValuationTotals {
  /** Every holding in scope, priced or not. */
  totalInvestment: number;
  /** Priced holdings only. The denominator for returns. */
  pricedInvestment: number;
  totalPresentValue: number;
  totalGainLoss: number;
  totalGainLossPct: number;

  pricedHoldingsCount: number;
  totalHoldingsCount: number;
  /** pricedInvestment / totalInvestment */
  valuationCoveragePct: number;
  completeness: "complete" | "partial";
}

export interface SectorSummary extends ValuationTotals {
  name: Sector;
  holdings: PortfolioHoldingView[];
}

export interface PortfolioResponse {
  summary: ValuationTotals;
  sectors: SectorSummary[];
  holdings: PortfolioHoldingView[];
  meta: {
    priceUpdatedAt: string | null;
    fundamentalsUpdatedAt: string | null;
    refreshIntervalMs: number;
    providers: {
      yahoo: ProviderStatus;
      googleFinance: ProviderStatus;
    };
    /** Rendered verbatim in the UI banner. */
    notices: string[];
  };
}
