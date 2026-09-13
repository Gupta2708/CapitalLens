/**
 * Shared domain types.
 *
 * Naming rule that matters throughout this codebase:
 *   - `source*`  = what the assignment workbook said (never mutated)
 *   - `price*`   = where the live quote actually came from
 * These are kept apart so a BSE-coded holding priced on NSE never silently
 * implies the quote came from BSE.
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

/** A static position as normalized from the workbook. */
export interface Holding {
  id: string;
  name: string;
  sector: Sector;

  /** Cost basis exactly as supplied by the workbook. Never adjusted. */
  purchasePrice: number;
  quantity: number;

  /** Verbatim `NSE/BSE` cell from the sheet, e.g. "532174" or "HDFCBANK". */
  sourceExchangeCode: string;
  /** Which exchange that source code denotes. */
  sourceExchange: Exchange;

  /** Yahoo symbol used for the quote, e.g. "ICICIBANK.BO". */
  priceSymbol: string;
  /** Exchange the `priceSymbol` trades on. Compared against `sourceExchange`. */
  priceExchange: Exchange;
  /** Fallback symbol on the other exchange, used only if `priceSymbol` fails. */
  fallbackPriceSymbol: string | null;
  fallbackPriceExchange: Exchange | null;

  /** Google Finance symbol, e.g. "532174:BOM". Null when unmappable. */
  googleSymbol: string | null;
}

/** Freshness of a single field. `stale` means a cached value past its TTL. */
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

/** One row as rendered by the dashboard table. */
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

  /** Where this row's price actually came from; null when unpriced. */
  pricedOn: Exchange | null;
  /** True when the quote came from the fallback exchange, not the source one. */
  pricedOnFallbackExchange: boolean;

  quoteFreshness: DataFreshness;
  fundamentalsFreshness: DataFreshness;
  quotedAt: string | null;
}

/**
 * Valuation figures. Every "total" here is computed over the PRICED subset
 * only -- see `lib/portfolio/aggregate.ts` for why mixing populations is wrong.
 */
export interface ValuationTotals {
  /** Cost basis of every holding in scope, priced or not. */
  totalInvestment: number;
  /** Cost basis of the priced holdings only. Denominator for returns. */
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
    /** Human-readable notes surfaced in the UI banner. */
    notices: string[];
  };
}
