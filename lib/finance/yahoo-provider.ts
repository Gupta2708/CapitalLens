import { InFlightRegistry } from "@/lib/cache/inflight";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { isFiniteNumber } from "@/lib/portfolio/calculations";
import type { Exchange, QuoteResult } from "./types";

/**
 * Yahoo Finance quote adapter -- the only module that knows Yahoo exists.
 *
 * Uses `v8/finance/chart` rather than `yahoo-finance2`, whose quote path wraps
 * `v7/finance/quote`. That endpoint now answers HTTP 401 without a cookie and
 * crumb handshake, while the chart endpoint returns price, currency and
 * exchange unauthenticated.
 */

const YAHOO_CHART_BASE =
  process.env.YAHOO_CHART_BASE ??
  "https://query1.finance.yahoo.com/v8/finance/chart";

const QUOTE_TTL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_CONCURRENCY = 8;

const quoteCache = new TtlCache<QuoteResult>(QUOTE_TTL_MS);
const inFlight = new InFlightRegistry<QuoteResult>();

/** The endpoint is unreliable for unidentified clients. */
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
} as const;

interface YahooChartMeta {
  regularMarketPrice?: unknown;
  currency?: unknown;
  fullExchangeName?: unknown;
}

/**
 * Rejects quotes that are structurally valid but semantically wrong.
 *
 * `541557.BO` returns HTTP 200 with the right company name, a price of
 * 10,603,328,500 and a null currency on an exchange called "YHD". Without this
 * check that value lands in the portfolio as a real valuation.
 */
export function isUsableQuote(meta: YahooChartMeta): boolean {
  const price = meta.regularMarketPrice;

  if (!isFiniteNumber(price) || price <= 0) return false;
  if (meta.currency !== "INR") return false;
  if (meta.fullExchangeName !== "NSE" && meta.fullExchangeName !== "BSE") {
    return false;
  }

  return true;
}

function normalizeExchange(value: unknown): Exchange | null {
  return value === "NSE" || value === "BSE" ? value : null;
}

async function fetchQuoteUncached(symbol: string): Promise<QuoteResult> {
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Yahoo responded ${response.status} for ${symbol}`);
  }

  const payload = (await response.json()) as {
    chart?: { result?: Array<{ meta?: YahooChartMeta }> };
  };

  const meta = payload?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Yahoo returned no metadata for ${symbol}`);

  if (!isUsableQuote(meta)) {
    throw new Error(
      `Rejected implausible quote for ${symbol}: ` +
        `${String(meta.regularMarketPrice)} ${String(meta.currency)} on ${String(meta.fullExchangeName)}`,
    );
  }

  return {
    symbol,
    exchange: normalizeExchange(meta.fullExchangeName),
    price: meta.regularMarketPrice as number,
    currency: "INR",
    fetchedAt: new Date().toISOString(),
    source: "yahoo",
    freshness: "live",
  };
}

/**
 * Fresh cache hit, then a live call, then an expired cache entry marked stale,
 * then unavailable with a null price.
 */
export async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const cached = quoteCache.get(symbol);
  if (cached) return cached;

  return inFlight.run(symbol, async () => {
    try {
      const quote = await fetchQuoteUncached(symbol);
      quoteCache.set(symbol, quote);
      return quote;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const stale = quoteCache.getStale(symbol);
      if (stale && isFiniteNumber(stale.value.price)) {
        return {
          ...stale.value,
          fetchedAt: new Date(stale.storedAt).toISOString(),
          freshness: "stale" as const,
          error: message,
        };
      }

      return {
        symbol,
        exchange: null,
        price: null,
        currency: null,
        fetchedAt: new Date().toISOString(),
        source: "yahoo" as const,
        freshness: "unavailable" as const,
        error: message,
      };
    }
  });
}

/** Bounded concurrency; `fetchQuote` never rejects, so one bad symbol is contained. */
export async function fetchQuotes(
  symbols: string[],
): Promise<Map<string, QuoteResult>> {
  const unique = [...new Set(symbols)];
  const results = new Map<string, QuoteResult>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < unique.length) {
      const symbol = unique[cursor++];
      results.set(symbol, await fetchQuote(symbol));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, unique.length) }, worker),
  );

  return results;
}

export const __testing = { QUOTE_TTL_MS, quoteCache };
