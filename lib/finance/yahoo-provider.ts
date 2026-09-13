import { InFlightRegistry } from "@/lib/cache/inflight";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { isFiniteNumber } from "@/lib/portfolio/calculations";
import type { Exchange, QuoteResult } from "./types";

/**
 * Yahoo Finance quote adapter -- the ONLY place that knows Yahoo exists.
 *
 * Why the chart endpoint rather than `yahoo-finance2`
 * ---------------------------------------------------
 * The library's quote path wraps `v7/finance/quote`, which now answers
 * HTTP 401 ("User is unable to access this feature") without a cookie+crumb
 * handshake. The unauthenticated `v8/finance/chart/{symbol}` endpoint returns
 * everything we need in `chart.result[0].meta`:
 *
 *   { regularMarketPrice: 1700.15, currency: "INR", fullExchangeName: "NSE" }
 *
 * That is ~30 lines to wrap, has no auth dance to break, and is easy to explain.
 * Swapping providers means rewriting this file and nothing else.
 */

const YAHOO_CHART_BASE =
  process.env.YAHOO_CHART_BASE ??
  "https://query1.finance.yahoo.com/v8/finance/chart";

/** Short server-side TTL: absorbs duplicate requests inside one refresh tick. */
const QUOTE_TTL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** Bounded parallelism: fast enough for 26 symbols, gentle on the provider. */
const MAX_CONCURRENCY = 8;

const quoteCache = new TtlCache<QuoteResult>(QUOTE_TTL_MS);
const inFlight = new InFlightRegistry<QuoteResult>();

/** Browser-ish UA: the endpoint is unreliable for unidentified clients. */
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
 * Rejects quotes that are structurally fine but semantically wrong.
 *
 * This is not paranoia. `541557.BO` (Fine Organic's BSE code) returns HTTP 200
 * with the correct company name, a price of 10,603,328,500 and currency null on
 * an exchange called "YHD". Without this guard that number lands in the
 * portfolio as a real valuation and corrupts every total above it.
 *
 * A quote is usable only if it is INR, on NSE or BSE, and a positive finite
 * number.
 */
export function isUsableQuote(meta: YahooChartMeta): boolean {
  const price = meta.regularMarketPrice;
  const currency = meta.currency;
  const exchange = meta.fullExchangeName;

  if (!isFiniteNumber(price) || price <= 0) return false;
  if (currency !== "INR") return false;
  if (exchange !== "NSE" && exchange !== "BSE") return false;

  return true;
}

function normalizeExchange(value: unknown): Exchange | null {
  return value === "NSE" || value === "BSE" ? value : null;
}

/** Performs one upstream call and normalizes it. Throws on any failure. */
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
      `Rejected implausible quote for ${symbol} ` +
        `(price=${String(meta.regularMarketPrice)}, ` +
        `currency=${String(meta.currency)}, ` +
        `exchange=${String(meta.fullExchangeName)})`,
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
 * Fetches one quote through the cache and the in-flight registry.
 *
 * Failure ladder, in order:
 *   1. fresh cache hit          -> live
 *   2. successful upstream call -> live
 *   3. expired cache entry      -> stale (clearly labelled, still counts as priced)
 *   4. nothing                  -> unavailable (null price, never zero)
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

      // Prefer a known-old price over no price, but never present it as live.
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

/**
 * Fetches many quotes with bounded concurrency.
 *
 * `fetchQuote` already converts failures into unavailable results, so a single
 * bad symbol can never reject this call and take the dashboard down with it.
 */
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

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, unique.length) },
    worker,
  );
  await Promise.all(workers);

  return results;
}

export const __testing = { QUOTE_TTL_MS, quoteCache };
