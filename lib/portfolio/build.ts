import { HOLDINGS } from "@/data/holdings";
import { fetchManyFundamentals } from "@/lib/finance/google-finance-provider";
import { fetchQuote, fetchQuotes } from "@/lib/finance/yahoo-provider";
import type {
  FundamentalsResult,
  Holding,
  PortfolioHoldingView,
  PortfolioResponse,
  ProviderStatus,
  QuoteResult,
} from "@/lib/finance/types";
import { buildSectorSummaries, buildTotals } from "./aggregate";
import {
  gainLoss as calcGainLoss,
  gainLossPct as calcGainLossPct,
  investment as calcInvestment,
  portfolioPct as calcPortfolioPct,
  presentValue as calcPresentValue,
  isFiniteNumber,
} from "./calculations";

export const REFRESH_INTERVAL_MS = 15_000;

/**
 * Resolves a usable quote for one holding.
 *
 * Preference is always the holding's own source exchange -- a BSE-coded row
 * should be priced on BSE. Only if that symbol fails do we try the other
 * exchange, and the caller records that it happened so the UI can say so. The
 * two exchanges quote the same company at slightly different prices, so
 * silently substituting one for the other would misreport where the number
 * came from.
 */
async function resolveQuote(
  holding: Holding,
  primaryQuotes: Map<string, QuoteResult>,
): Promise<{ quote: QuoteResult; usedFallback: boolean }> {
  const primary = primaryQuotes.get(holding.priceSymbol);

  if (primary && isFiniteNumber(primary.price)) {
    return { quote: primary, usedFallback: false };
  }

  if (holding.fallbackPriceSymbol) {
    const fallback = await fetchQuote(holding.fallbackPriceSymbol);
    if (isFiniteNumber(fallback.price)) {
      return { quote: fallback, usedFallback: true };
    }
  }

  // Nothing usable: return the primary attempt so its error survives.
  return {
    quote: primary ?? {
      symbol: holding.priceSymbol,
      exchange: null,
      price: null,
      currency: null,
      fetchedAt: new Date().toISOString(),
      source: "yahoo",
      freshness: "unavailable",
      error: "No quote attempted",
    },
    usedFallback: false,
  };
}

function toView(
  holding: Holding,
  quote: QuoteResult,
  usedFallback: boolean,
  fundamentals: FundamentalsResult | undefined,
  totalInvestment: number,
): PortfolioHoldingView {
  const investment = calcInvestment(holding.purchasePrice, holding.quantity);
  const cmp = isFiniteNumber(quote.price) ? quote.price : null;
  const presentValue = calcPresentValue(cmp, holding.quantity);
  const gainLoss = calcGainLoss(presentValue, investment);

  const pricedOn = cmp === null
    ? null
    : quote.exchange ??
      (usedFallback ? holding.fallbackPriceExchange : holding.priceExchange);

  return {
    id: holding.id,
    name: holding.name,
    sector: holding.sector,

    purchasePrice: holding.purchasePrice,
    quantity: holding.quantity,
    investment,
    portfolioPct: calcPortfolioPct(investment, totalInvestment),

    sourceExchangeCode: holding.sourceExchangeCode,
    sourceExchange: holding.sourceExchange,

    cmp,
    presentValue,
    gainLoss,
    gainLossPct: calcGainLossPct(gainLoss, investment),

    peRatio: fundamentals?.peRatio ?? null,
    latestEarningsEps: fundamentals?.latestEarningsEps ?? null,

    pricedOn,
    pricedOnFallbackExchange:
      cmp !== null && pricedOn !== null && pricedOn !== holding.sourceExchange,

    quoteFreshness: cmp === null ? "unavailable" : quote.freshness,
    fundamentalsFreshness: fundamentals?.freshness ?? "unavailable",
    quotedAt: cmp === null ? null : quote.fetchedAt,
  };
}

/** Rolls per-item freshness up into one provider status for the UI banner. */
function summarizeStatus(states: Array<"live" | "stale" | "unavailable">): ProviderStatus {
  if (states.length === 0) return "error";
  const usable = states.filter((state) => state !== "unavailable").length;
  if (usable === states.length) return "ok";
  if (usable === 0) return "error";
  return "partial";
}

function mostRecent(timestamps: Array<string | null>): string | null {
  const valid = timestamps.filter((value): value is string => value !== null);
  if (valid.length === 0) return null;
  return valid.reduce((latest, value) => (value > latest ? value : latest));
}

/**
 * Builds the full dashboard payload.
 *
 * Prices and fundamentals are fetched as two independent batches in parallel,
 * each already internally failure-isolated, so a total Google outage still
 * returns live prices and a total Yahoo outage still returns the static
 * portfolio with its fundamentals.
 */
export async function buildPortfolio(): Promise<PortfolioResponse> {
  const totalInvestment = HOLDINGS.reduce(
    (sum, holding) => sum + calcInvestment(holding.purchasePrice, holding.quantity),
    0,
  );

  const googleSymbols = HOLDINGS.map((holding) => holding.googleSymbol).filter(
    (symbol): symbol is string => symbol !== null,
  );

  // allSettled: neither provider can reject the whole dashboard.
  const [quotesOutcome, fundamentalsOutcome] = await Promise.allSettled([
    fetchQuotes(HOLDINGS.map((holding) => holding.priceSymbol)),
    fetchManyFundamentals(googleSymbols),
  ]);

  const primaryQuotes =
    quotesOutcome.status === "fulfilled"
      ? quotesOutcome.value
      : new Map<string, QuoteResult>();

  const fundamentalsBySymbol =
    fundamentalsOutcome.status === "fulfilled"
      ? fundamentalsOutcome.value
      : new Map<string, FundamentalsResult>();

  const rows: PortfolioHoldingView[] = [];
  for (const holding of HOLDINGS) {
    const { quote, usedFallback } = await resolveQuote(holding, primaryQuotes);
    const fundamentals = holding.googleSymbol
      ? fundamentalsBySymbol.get(holding.googleSymbol)
      : undefined;

    rows.push(
      toView(holding, quote, usedFallback, fundamentals, totalInvestment),
    );
  }

  const summary = buildTotals(rows);
  const sectors = buildSectorSummaries(rows);

  const yahooStatus = summarizeStatus(rows.map((row) => row.quoteFreshness));
  const googleStatus = summarizeStatus(
    rows.map((row) => row.fundamentalsFreshness),
  );

  // Plain-language notices; the UI renders these verbatim.
  const notices: string[] = [];

  const unpricedCount = rows.length - summary.pricedHoldingsCount;
  if (unpricedCount > 0) {
    notices.push(
      `Live prices are unavailable for ${unpricedCount} of ${rows.length} holdings. ` +
        `Portfolio value and returns below cover the ${summary.pricedHoldingsCount} priced holdings only.`,
    );
  }

  const staleQuotes = rows.filter((row) => row.quoteFreshness === "stale").length;
  if (staleQuotes > 0) {
    notices.push(
      `${staleQuotes} price${staleQuotes === 1 ? "" : "s"} shown from the last successful fetch, not live.`,
    );
  }

  const missingFundamentals = rows.filter(
    (row) => row.fundamentalsFreshness === "unavailable",
  ).length;
  if (missingFundamentals > 0) {
    notices.push(
      `P/E and EPS are temporarily unavailable for ${missingFundamentals} holding${missingFundamentals === 1 ? "" : "s"}. Prices are unaffected.`,
    );
  }

  const fallbackRows = rows.filter((row) => row.pricedOnFallbackExchange);
  if (fallbackRows.length > 0) {
    notices.push(
      `${fallbackRows.length} holding${fallbackRows.length === 1 ? " is" : "s are"} quoted on the alternate exchange because the source listing did not respond.`,
    );
  }

  return {
    summary,
    sectors,
    holdings: rows,
    meta: {
      priceUpdatedAt: mostRecent(rows.map((row) => row.quotedAt)),
      fundamentalsUpdatedAt: mostRecent(
        [...fundamentalsBySymbol.values()]
          .filter((result) => result.freshness === "live")
          .map((result) => result.fetchedAt),
      ),
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      providers: { yahoo: yahooStatus, googleFinance: googleStatus },
      notices,
    },
  };
}
