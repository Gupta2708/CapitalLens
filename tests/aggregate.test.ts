import { describe, expect, it } from "vitest";
import {
  buildSectorSummaries,
  buildTotals,
  findPerformers,
} from "@/lib/portfolio/aggregate";
import type { PortfolioHoldingView, Sector } from "@/lib/finance/types";

/** Builds a table row with sensible defaults; override what the test cares about. */
function row(
  overrides: Partial<PortfolioHoldingView> & {
    investment: number;
    presentValue: number | null;
  },
): PortfolioHoldingView {
  const investment = overrides.investment;
  const presentValue = overrides.presentValue;
  const gainLoss = presentValue === null ? null : presentValue - investment;

  return {
    id: overrides.id ?? "test",
    name: overrides.name ?? "Test Holding",
    sector: (overrides.sector ?? "Others") as Sector,
    purchasePrice: overrides.purchasePrice ?? 100,
    quantity: overrides.quantity ?? 1,
    investment,
    portfolioPct: overrides.portfolioPct ?? 0,
    sourceExchangeCode: overrides.sourceExchangeCode ?? "TEST",
    sourceExchange: overrides.sourceExchange ?? "NSE",
    cmp: overrides.cmp ?? null,
    presentValue,
    gainLoss,
    gainLossPct:
      gainLoss === null || investment === 0 ? null : gainLoss / investment,
    peRatio: overrides.peRatio ?? null,
    latestEarningsEps: overrides.latestEarningsEps ?? null,
    pricedOn: presentValue === null ? null : "NSE",
    pricedOnFallbackExchange: overrides.pricedOnFallbackExchange ?? false,
    quoteFreshness:
      overrides.quoteFreshness ?? (presentValue === null ? "unavailable" : "live"),
    fundamentalsFreshness: overrides.fundamentalsFreshness ?? "live",
    quotedAt: overrides.quotedAt ?? null,
  };
}

describe("buildTotals -- fully priced portfolio", () => {
  const totals = buildTotals([
    row({ investment: 74_500, presentValue: 85_007.5 }),
    row({ investment: 65_520, presentValue: 56_876.4 }),
  ]);

  it("sums the full cost basis", () => {
    expect(totals.totalInvestment).toBe(140_020);
  });

  it("sums present value", () => {
    expect(totals.totalPresentValue).toBeCloseTo(141_883.9, 4);
  });

  it("reports gain over the same population", () => {
    expect(totals.totalGainLoss).toBeCloseTo(1_863.9, 4);
  });

  it("marks itself complete with full coverage", () => {
    expect(totals.completeness).toBe("complete");
    expect(totals.valuationCoveragePct).toBe(1);
    expect(totals.pricedHoldingsCount).toBe(2);
    expect(totals.totalHoldingsCount).toBe(2);
  });
});

describe("buildTotals -- partial valuation (the population-mixing regression)", () => {
  // Two priced holdings, two that could not be priced.
  const rows = [
    row({ id: "a", investment: 100_000, presentValue: 110_000 }),
    row({ id: "b", investment: 50_000, presentValue: 55_000 }),
    row({ id: "c", investment: 40_000, presentValue: null }),
    row({ id: "d", investment: 10_000, presentValue: null }),
  ];
  const totals = buildTotals(rows);

  it("still reports the FULL cost basis as totalInvestment", () => {
    expect(totals.totalInvestment).toBe(200_000);
  });

  it("reports pricedInvestment separately", () => {
    expect(totals.pricedInvestment).toBe(150_000);
  });

  it("subtracts pricedInvestment, NOT totalInvestment", () => {
    // The bug this guards against: 165,000 - 200,000 = -35,000, which would
    // show a loss on a portfolio that is actually up 15,000. The unpriced
    // holdings must not be counted as worthless.
    expect(totals.totalGainLoss).toBe(15_000);
    expect(totals.totalGainLoss).not.toBe(-35_000);
  });

  it("divides the return by pricedInvestment", () => {
    // 15,000 / 150,000 = 10%, not 15,000 / 200,000 = 7.5%
    expect(totals.totalGainLossPct).toBeCloseTo(0.1, 10);
  });

  it("exposes coverage so the UI can explain the figures", () => {
    expect(totals.pricedHoldingsCount).toBe(2);
    expect(totals.totalHoldingsCount).toBe(4);
    expect(totals.valuationCoveragePct).toBe(0.75);
    expect(totals.completeness).toBe("partial");
  });
});

describe("buildTotals -- nothing priced", () => {
  const totals = buildTotals([
    row({ investment: 10_000, presentValue: null }),
    row({ investment: 20_000, presentValue: null }),
  ]);

  it("reports zeroes rather than NaN when there is no priced basis", () => {
    expect(totals.totalGainLoss).toBe(0);
    expect(totals.totalGainLossPct).toBe(0);
    expect(totals.valuationCoveragePct).toBe(0);
    expect(Number.isNaN(totals.totalGainLossPct)).toBe(false);
  });

  it("is partial with zero coverage", () => {
    expect(totals.completeness).toBe("partial");
    expect(totals.pricedHoldingsCount).toBe(0);
  });
});

describe("buildTotals -- empty input", () => {
  it("does not divide by zero", () => {
    const totals = buildTotals([]);
    expect(totals.totalGainLossPct).toBe(0);
    expect(totals.valuationCoveragePct).toBe(0);
    expect(totals.completeness).toBe("complete");
  });
});

describe("buildSectorSummaries", () => {
  const rows = [
    row({ id: "a", sector: "Tech Sector", investment: 50_000, presentValue: 60_000 }),
    row({ id: "b", sector: "Tech Sector", investment: 30_000, presentValue: null }),
    row({ id: "c", sector: "Power", investment: 20_000, presentValue: 18_000 }),
  ];
  const sectors = buildSectorSummaries(rows);

  it("only emits sectors that have holdings", () => {
    expect(sectors.map((sector) => sector.name)).toEqual(["Tech Sector", "Power"]);
  });

  it("preserves workbook sector order rather than sorting", () => {
    // Tech Sector precedes Power in the source sheet.
    expect(sectors[0].name).toBe("Tech Sector");
  });

  it("applies the priced-subset rule per sector too", () => {
    const tech = sectors[0];
    expect(tech.totalInvestment).toBe(80_000);
    expect(tech.pricedInvestment).toBe(50_000);
    expect(tech.totalGainLoss).toBe(10_000);
    expect(tech.completeness).toBe("partial");
  });

  it("keeps a fully priced sector complete", () => {
    expect(sectors[1].completeness).toBe("complete");
    expect(sectors[1].totalGainLoss).toBe(-2_000);
  });

  it("sums sector investments back to the portfolio total", () => {
    const sectorSum = sectors.reduce((total, s) => total + s.totalInvestment, 0);
    expect(sectorSum).toBe(buildTotals(rows).totalInvestment);
  });
});

describe("findPerformers", () => {
  it("picks best and worst by return percentage", () => {
    const rows = [
      row({ id: "win", investment: 1_000, presentValue: 1_500 }), // +50%
      row({ id: "mid", investment: 1_000, presentValue: 1_100 }), // +10%
      row({ id: "lose", investment: 1_000, presentValue: 700 }), // -30%
    ];
    const { best, worst } = findPerformers(rows);
    expect(best?.id).toBe("win");
    expect(worst?.id).toBe("lose");
  });

  it("ignores unpriced holdings instead of ranking them as -100%", () => {
    const rows = [
      row({ id: "priced", investment: 1_000, presentValue: 900 }),
      row({ id: "unpriced", investment: 1_000, presentValue: null }),
    ];
    const { best, worst } = findPerformers(rows);
    expect(best?.id).toBe("priced");
    expect(worst?.id).toBe("priced");
  });

  it("returns nulls when nothing can be valued", () => {
    const { best, worst } = findPerformers([
      row({ investment: 1_000, presentValue: null }),
    ]);
    expect(best).toBeNull();
    expect(worst).toBeNull();
  });
});
