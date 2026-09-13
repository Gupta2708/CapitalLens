import { describe, expect, it } from "vitest";
import {
  EM_DASH,
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
  trendOf,
} from "@/lib/format/currency";

/**
 * The formatters are the single boundary where numbers become text, so this
 * suite is what actually guarantees the brief's "never display NaN, undefined
 * or Infinity" requirement.
 */
describe("bad values never reach the screen", () => {
  const formatters = [
    formatCurrency,
    formatSignedCurrency,
    formatCompactCurrency,
    formatPercent,
    formatSignedPercent,
    formatNumber,
  ];

  const badValues = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it("renders an em-dash for every unusable value", () => {
    for (const format of formatters) {
      for (const value of badValues) {
        expect(format(value as number | null)).toBe(EM_DASH);
      }
    }
  });

  it("never emits the strings NaN, Infinity or undefined", () => {
    for (const format of formatters) {
      for (const value of badValues) {
        const output = format(value as number | null);
        expect(output).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it("handles an invalid timestamp", () => {
    expect(formatTime(null)).toBe(EM_DASH);
    expect(formatTime("not-a-date")).toBe(EM_DASH);
  });
});

describe("currency formatting", () => {
  it("uses Indian digit grouping", () => {
    // 15,43,060 -- not 1,543,060
    expect(formatCurrency(1_543_060)).toContain("15,43,060");
  });

  it("signs gains and losses explicitly", () => {
    expect(formatSignedCurrency(10_508)).toMatch(/^\+/);
    expect(formatSignedCurrency(-8_644)).toMatch(/^-/);
    expect(formatSignedCurrency(0)).not.toMatch(/^[+-]/);
  });

  it("compacts to lakhs and crores", () => {
    expect(formatCompactCurrency(1_543_060)).toBe("₹15.43L");
    expect(formatCompactCurrency(12_000_000)).toBe("₹1.20Cr");
    expect(formatCompactCurrency(-1_543_060)).toBe("-₹15.43L");
  });

  it("leaves small amounts uncompacted", () => {
    expect(formatCompactCurrency(74_500)).toContain("74,500");
  });
});

describe("percent formatting", () => {
  it("converts a fraction to a percentage", () => {
    expect(formatPercent(0.0483)).toBe("4.83%");
  });

  it("signs positive returns", () => {
    expect(formatSignedPercent(0.141)).toBe("+14.10%");
    expect(formatSignedPercent(-0.1319)).toBe("-13.19%");
  });
});

describe("trendOf", () => {
  it("buckets by sign and treats missing data as flat", () => {
    expect(trendOf(5)).toBe("up");
    expect(trendOf(-5)).toBe("down");
    expect(trendOf(0)).toBe("flat");
    expect(trendOf(null)).toBe("flat");
    expect(trendOf(Number.NaN)).toBe("flat");
  });
});
