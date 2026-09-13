import * as cheerio from "cheerio";
import { InFlightRegistry } from "@/lib/cache/inflight";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { parseProviderNumber } from "@/lib/portfolio/calculations";
import type { FundamentalsResult } from "./types";

/**
 * Google Finance fundamentals adapter (P/E ratio and EPS).
 *
 * Google exposes no official API for this, so the assignment explicitly allows
 * scraping. All of that scraping lives in this file; nothing downstream knows
 * the data arrived as HTML.
 *
 * Parsing strategy: match the LABEL TEXT, not the CSS class
 * ---------------------------------------------------------
 * The key-stats block looks like this, with obfuscated class names:
 *
 *   <div class="gyFHrc">
 *     <div class="mfs7Fc">P/E ratio</div>
 *     <div class="P6K39c">13.84</div>
 *   </div>
 *
 * Those class names are build artifacts and rotate without notice. The visible
 * labels ("P/E ratio", "EPS") are product copy and change far more rarely, so
 * the parser finds the label node and reads its sibling value. When Google
 * eventually reshuffles the markup this returns null and the dashboard degrades
 * to an em-dash -- it does not crash and it does not invent a number.
 */

const GOOGLE_FINANCE_BASE =
  process.env.GOOGLE_FINANCE_BASE ?? "https://www.google.com/finance/quote";

/**
 * 45 minutes. P/E and EPS move on quarterly earnings, not by the second, so
 * scraping them on the 15-second price cadence would be ~180x the requests for
 * no new information -- and a fast route to being rate-limited or blocked.
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
 * Finds a key-stat by its visible label and returns the adjacent value text.
 *
 * Exported so the parser can be unit-tested against a saved fixture without
 * touching the network.
 */
export function extractLabelledStat(html: string, label: string): string | null {
  const $ = cheerio.load(html);

  // Google renders each stat as a label node and a value node that are
  // siblings inside a small wrapper. Find the element whose own text is exactly
  // the label, then read the next element in the same row.
  let value: string | null = null;

  $("div").each((_, element) => {
    if (value !== null) return false; // already found; stop walking

    const node = $(element);
    // `.text()` on a parent would concatenate children, so only consider nodes
    // whose trimmed text matches the label exactly.
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

/** Parses P/E and EPS out of a Google Finance quote page. */
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
  const url = `${GOOGLE_FINANCE_BASE}/${symbol}`;

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Finance responded ${response.status} for ${symbol}`);
  }

  const html = await response.text();
  const { peRatio, latestEarningsEps } = parseFundamentalsHtml(html);

  return {
    symbol,
    peRatio,
    latestEarningsEps,
    fetchedAt: new Date().toISOString(),
    source: "google-finance",
    // A page that loads but exposes neither figure is "unavailable", not an
    // error: LTM (the renamed LTIMindtree) is exactly this case today.
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

/** Bounded-concurrency batch fetch. Individual failures never reject. */
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
