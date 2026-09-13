import { describe, expect, it } from "vitest";
import {
  EXPECTED_HOLDING_COUNT,
  EXPECTED_SECTOR_COUNT,
  EXPECTED_TOTAL_INVESTMENT,
  HOLDINGS,
} from "@/data/holdings";
import { SECTORS } from "@/lib/finance/types";
import { isUsableQuote } from "@/lib/finance/yahoo-provider";
import { investment } from "@/lib/portfolio/calculations";

/**
 * Regression tests against the source workbook. If a holding is ever edited,
 * these fail loudly rather than letting the dashboard drift from the sheet.
 */
describe("source data sanity", () => {
  it("has 26 active holdings", () => {
    expect(HOLDINGS).toHaveLength(EXPECTED_HOLDING_COUNT);
  });

  it("covers 6 sectors", () => {
    const sectors = new Set(HOLDINGS.map((holding) => holding.sector));
    expect(sectors.size).toBe(EXPECTED_SECTOR_COUNT);
  });

  it("only uses sectors declared in SECTORS", () => {
    for (const holding of HOLDINGS) {
      expect(SECTORS).toContain(holding.sector);
    }
  });

  it("totals 1,543,060 in investment", () => {
    const total = HOLDINGS.reduce(
      (sum, holding) => sum + investment(holding.purchasePrice, holding.quantity),
      0,
    );
    expect(total).toBe(EXPECTED_TOTAL_INVESTMENT);
  });

  it("excludes the exited positions from below the workbook total row", () => {
    const names = HOLDINGS.map((holding) => holding.name.toLowerCase());
    for (const exited of ["infy", "happeist mind", "happiest mind", "easemytrip"]) {
      expect(names).not.toContain(exited);
    }
  });

  it("has unique ids", () => {
    const ids = new Set(HOLDINGS.map((holding) => holding.id));
    expect(ids.size).toBe(HOLDINGS.length);
  });

  it("has positive prices and quantities everywhere", () => {
    for (const holding of HOLDINGS) {
      expect(holding.purchasePrice).toBeGreaterThan(0);
      expect(holding.quantity).toBeGreaterThan(0);
    }
  });
});

describe("provider symbol mapping", () => {
  it("suffixes every price symbol for the exchange it claims", () => {
    for (const holding of HOLDINGS) {
      const suffix = holding.priceExchange === "NSE" ? ".NS" : ".BO";
      expect(holding.priceSymbol.endsWith(suffix)).toBe(true);
    }
  });

  it("never applies the naive sourceCode + .NS transform to a BSE code", () => {
    // The transform the brief warns about. For the five genuinely NSE-listed
    // rows `HDFCBANK` + `.NS` happens to be right, so the meaningful invariant
    // is narrower: no BSE-coded holding may be mapped that way, because a BSE
    // security code is not an NSE ticker.
    const naive = HOLDINGS.filter(
      (holding) =>
        holding.sourceExchange === "BSE" &&
        holding.priceSymbol === `${holding.sourceExchangeCode}.NS`,
    );
    expect(naive.map((holding) => holding.name)).toEqual([]);
  });

  it("does not assume a numeric BSE code is a valid Yahoo symbol", () => {
    // Only Savani genuinely quotes under its numeric code (511577.BO); every
    // other BSE row needed a real ticker, which is why the map is hand-verified.
    const numericSymbols = HOLDINGS.filter((holding) =>
      /^\d+\.(BO|NS)$/.test(holding.priceSymbol),
    ).map((holding) => holding.priceSymbol);

    expect(numericSymbols).toEqual(["511577.BO"]);
  });

  it("never uses the two symbols verified to be wrong upstream", () => {
    const symbols = HOLDINGS.flatMap((holding) => [
      holding.priceSymbol,
      holding.fallbackPriceSymbol,
    ]);
    // 532174.BO 404s; 541557.BO returns an unrelated YHD listing at ~1.06e10.
    expect(symbols).not.toContain("532174.BO");
    expect(symbols).not.toContain("541557.BO");
  });

  it("prices every holding on its own source exchange by default", () => {
    for (const holding of HOLDINGS) {
      expect(holding.priceExchange).toBe(holding.sourceExchange);
    }
  });

  it("points fallbacks at the opposite exchange", () => {
    for (const holding of HOLDINGS) {
      if (holding.fallbackPriceExchange === null) continue;
      expect(holding.fallbackPriceExchange).not.toBe(holding.priceExchange);
    }
  });

  it("maps NSE codes to :NSE and BSE codes to :BOM on Google", () => {
    for (const holding of HOLDINGS) {
      if (holding.googleSymbol === null) continue;
      const expected = holding.sourceExchange === "NSE" ? ":NSE" : ":BOM";
      expect(holding.googleSymbol.endsWith(expected)).toBe(true);
    }
  });

  it("keeps the renamed LTIMindtree ticker separate from its source code", () => {
    const ltm = HOLDINGS.find((holding) => holding.id === "lti-mindtree");
    // The workbook still says LTIM; NSE renamed the listing to LTM.
    expect(ltm?.sourceExchangeCode).toBe("LTIM");
    expect(ltm?.priceSymbol).toBe("LTM.NS");
  });
});

describe("isUsableQuote", () => {
  it("accepts a normal INR quote on NSE", () => {
    expect(
      isUsableQuote({
        regularMarketPrice: 1700.15,
        currency: "INR",
        fullExchangeName: "NSE",
      }),
    ).toBe(true);
  });

  it("accepts BSE", () => {
    expect(
      isUsableQuote({
        regularMarketPrice: 21.75,
        currency: "INR",
        fullExchangeName: "BSE",
      }),
    ).toBe(true);
  });

  it("rejects the wrong-instrument match seen for 541557.BO", () => {
    // Real upstream response: HTTP 200, correct company name, but a price of
    // 1.06e10 with a null currency on an exchange called YHD. Without this
    // guard that number becomes a portfolio valuation.
    expect(
      isUsableQuote({
        regularMarketPrice: 10_603_328_500,
        currency: null,
        fullExchangeName: "YHD",
      }),
    ).toBe(false);
  });

  it("rejects a non-INR quote", () => {
    expect(
      isUsableQuote({
        regularMarketPrice: 42,
        currency: "USD",
        fullExchangeName: "NSE",
      }),
    ).toBe(false);
  });

  it("rejects zero, negative, NaN and missing prices", () => {
    const base = { currency: "INR", fullExchangeName: "NSE" };
    expect(isUsableQuote({ ...base, regularMarketPrice: 0 })).toBe(false);
    expect(isUsableQuote({ ...base, regularMarketPrice: -5 })).toBe(false);
    expect(isUsableQuote({ ...base, regularMarketPrice: Number.NaN })).toBe(false);
    expect(isUsableQuote({ ...base })).toBe(false);
  });
});
