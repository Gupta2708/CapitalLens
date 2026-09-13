import * as cheerio from "cheerio";
import { InFlightRegistry } from "@/lib/cache/inflight";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { parseProviderNumber } from "@/lib/portfolio/calculations";
import type { FundamentalsResult } from "./types";

/**
 * Google Finance fundamentals adapter (P/E and EPS). Google publishes no
 * official API for these, so the quote page is fetched and parsed here -- and
 * only here; nothing downstream knows the data arrived as HTML.
 */

const GOOGLE_FINANCE_BASE =
  process.env.GOOGLE_FINANCE_BASE ?? "https://www.google.com/finance/quote";

/**
 * P/E and EPS move on quarterly earnings, so scraping them at the 15-second
 * price cadence would be ~180x the requests for identical values.
 */
const FUNDAMENTALS_TTL_MS = 45 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONCURRENCY = 4;

const fundamentalsCache = new TtlCache<FundamentalsResult>(FUNDAMENTALS_TTL_MS);
const inFlight = new InFlightRegistry<FundamentalsResult>();

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml",
} as const;

/**
 * Finds a key stat by its visible label and returns the adjacent value.
 *
 * Matching label text rather than CSS classes is deliberate: the class names
 * on that block are build artifacts that rotate without notice, while the
 * labels are product copy. When the markup does change this returns null and
 * the UI shows an em-dash, rather than a wrong number.
 */
export function extractLabelledStat(html: string, label: string): string | null {
  const $ = cheerio.load(html);
  let value: string | null = null;

  $("div").each((_, element) => {
    if (value !== null) return false;

    const node = $(element);
    // Exact match only: `.text()` on a parent would concatenate its children.
    if (node.text().trim() !== label) return undefined;

    const sibling = node.next("div");
    if (sibling.length > 0) {
      const siblingText = sibling.text().trim();
      if (siblingText.length > 0) {
        value = siblingText;
        return false;
      }
    }
    return undefined;
  });

  return value;
}

export function parseFundamentalsHtml(html: string): {
  peRatio: number | null;
  latestEarningsEps: number | null;
} {
  return {
    peRatio: parseProviderNumber(extractLabelledStat(html, "P/E ratio")),
    // The workbook's "Latest Earnings" column is Google's EPS figure.
    latestEarningsEps: parseProviderNumber(extractLabelledStat(html, "EPS")),
  };
}

async function fetchFundamentalsUncached(
  symbol: string,
): Promise<FundamentalsResult> {
  const response = await fetch(`${GOOGLE_FINANCE_BASE}/${symbol}`, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Finance responded ${response.status} for ${symbol}`);
  }

  const { peRatio, latestEarningsEps } = parseFundamentalsHtml(
    await response.text(),
  );

  return {
    symbol,
    peRatio,
    latestEarningsEps,
    fetchedAt: new Date().toISOString(),
    source: "google-finance",
    // A page that loads but publishes neither figure is unavailable, not an
    // error: several listings genuinely have no P/E.
    freshness:
      peRatio === null && latestEarningsEps === null ? "unavailable" : "live",
  };
}

export async function fetchFundamentals(
  symbol: string,
): Promise<FundamentalsResult> {
  const cached = fundamentalsCache.get(symbol);
  if (cached) return cached;

  return inFlight.run(symbol, async () => {
    try {
      const result = await fetchFundamentalsUncached(symbol);
      fundamentalsCache.set(symbol, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const stale = fundamentalsCache.getStale(symbol);
      if (stale) {
        return {
          ...stale.value,
          fetchedAt: new Date(stale.storedAt).toISOString(),
          freshness: "stale" as const,
          error: message,
        };
      }

      return {
        symbol,
        peRatio: null,
        latestEarningsEps: null,
        fetchedAt: new Date().toISOString(),
        source: "google-finance" as const,
        freshness: "unavailable" as const,
        error: message,
      };
    }
  });
}

export async function fetchManyFundamentals(
  symbols: string[],
): Promise<Map<string, FundamentalsResult>> {
  const unique = [...new Set(symbols)];
  const results = new Map<string, FundamentalsResult>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < unique.length) {
      const symbol = unique[cursor++];
      results.set(symbol, await fetchFundamentals(symbol));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, unique.length) }, worker),
  );

  return results;
}

export const __testing = { FUNDAMENTALS_TTL_MS, fundamentalsCache };
