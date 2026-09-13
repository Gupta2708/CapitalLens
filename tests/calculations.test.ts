import { describe, expect, it } from "vitest";
import {
  gainLoss,
  gainLossPct,
  investment,
  parseProviderNumber,
  portfolioPct,
  presentValue,
  safeDivide,
} from "@/lib/portfolio/calculations";

describe("investment", () => {
  it("multiplies purchase price by quantity", () => {
    // HDFC Bank from the workbook: 1490 * 50 = 74,500
    expect(investment(1490, 50)).toBe(74_500);
  });

  it("handles fractional purchase prices", () => {
    expect(investment(24.5, 100)).toBe(2450);
  });
});

describe("portfolioPct", () => {
  it("returns the fraction of total investment", () => {
    // 74,500 / 1,543,060 = 0.04828...  (4.83% in the workbook)
    expect(portfolioPct(74_500, 1_543_060)).toBeCloseTo(0.0482807, 6);
  });

  it("returns 0 rather than Infinity when the total is zero", () => {
    expect(portfolioPct(74_500, 0)).toBe(0);
  });
});

describe("presentValue", () => {
  it("multiplies CMP by quantity", () => {
    expect(presentValue(1700.15, 50)).toBeCloseTo(85_007.5, 4);
  });

  it("returns null -- never zero -- for an unavailable CMP", () => {
    // Zero here would report a 100% loss on a position we simply could not
    // price. This assertion is the whole reason presentValue is nullable.
    expect(presentValue(null, 50)).toBeNull();
  });

  it("rejects NaN and Infinity from a bad provider response", () => {
    expect(presentValue(Number.NaN, 50)).toBeNull();
    expect(presentValue(Number.POSITIVE_INFINITY, 50)).toBeNull();
  });
});

describe("gainLoss", () => {
  it("subtracts investment from present value", () => {
    expect(gainLoss(85_007.5, 74_500)).toBeCloseTo(10_507.5, 4);
  });

  it("reports a negative figure for a loss", () => {
    // Bajaj Housing in the workbook: 56,876.40 - 65,520
    expect(gainLoss(56_876.4, 65_520)).toBeCloseTo(-8_643.6, 4);
  });

  it("propagates null when there is no present value", () => {
    expect(gainLoss(null, 74_500)).toBeNull();
  });
});

describe("gainLossPct", () => {
  it("divides gain by investment", () => {
    expect(gainLossPct(10_507.5, 74_500)).toBeCloseTo(0.1410402, 6);
  });

  it("returns null when investment is zero instead of dividing by zero", () => {
    expect(gainLossPct(100, 0)).toBeNull();
  });

  it("propagates null", () => {
    expect(gainLossPct(null, 74_500)).toBeNull();
  });
});

describe("safeDivide", () => {
  it("never returns Infinity", () => {
    expect(safeDivide(1, 0)).toBeNull();
  });

  it("never returns NaN", () => {
    expect(safeDivide(0, 0)).toBeNull();
    expect(safeDivide(Number.NaN, 5)).toBeNull();
  });

  it("divides normally otherwise", () => {
    expect(safeDivide(10, 4)).toBe(2.5);
  });
});

describe("parseProviderNumber", () => {
  it("parses a plain ratio", () => {
    expect(parseProviderNumber("13.84")).toBe(13.84);
  });

  it("strips currency symbols and separators", () => {
    expect(parseProviderNumber("₹51.21")).toBe(51.21);
    expect(parseProviderNumber("1,234.50")).toBe(1234.5);
  });

  it("keeps negative signs -- EPS can be negative", () => {
    // Savani Financials currently reports -4.60 on Google Finance.
    expect(parseProviderNumber("-₹4.60")).toBe(-4.6);
  });

  it("returns null for placeholders rather than guessing", () => {
    expect(parseProviderNumber("-")).toBeNull();
    expect(parseProviderNumber("N/A")).toBeNull();
    expect(parseProviderNumber("")).toBeNull();
    expect(parseProviderNumber(null)).toBeNull();
    expect(parseProviderNumber(undefined)).toBeNull();
  });
});
