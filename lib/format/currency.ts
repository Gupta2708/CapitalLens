/**
 * Display formatting.
 *
 * Every formatter here is null-safe and returns an em-dash for missing data.
 * Nothing in the UI formats a number by hand, which is how "NaN" and
 * "undefined" are kept off the screen: there is exactly one place where a
 * number becomes text.
 *
 * Grouping uses the `en-IN` locale, so values carry true Indian digit grouping
 * (15,43,060 rather than 1,543,060). The assignment brief writes its examples
 * with Western grouping, but it asks for "Indian currency formatting" -- this
 * follows the instruction rather than the typo in the sample.
 */

/** Rendered whenever a value is genuinely unavailable. */
export const EM_DASH = "—";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrPreciseFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function usable(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Whole-rupee currency, e.g. "₹15,43,060". */
export function formatCurrency(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return inrFormatter.format(value);
}

/** Two-decimal currency for prices, e.g. "₹1,700.15". */
export function formatPrice(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return inrPreciseFormatter.format(value);
}

/** Signed currency for gain/loss, e.g. "+₹10,508" / "-₹8,644". */
export function formatSignedCurrency(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inrFormatter.format(Math.abs(value))}`;
}

/**
 * Compact Indian notation for summary cards: "₹15.43L", "₹1.20Cr".
 * Falls back to full formatting below one lakh, where compacting adds nothing.
 */
export function formatCompactCurrency(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;

  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude >= 10_000_000) {
    return `${sign}₹${(magnitude / 10_000_000).toFixed(2)}Cr`;
  }
  if (magnitude >= 100_000) {
    return `${sign}₹${(magnitude / 100_000).toFixed(2)}L`;
  }
  return `${sign}${inrFormatter.format(magnitude)}`;
}

/**
 * Percentage from a FRACTION, e.g. 0.1410 -> "14.10%".
 * Calculations store fractions; the multiply by 100 happens only here.
 */
export function formatPercent(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return `${(value * 100).toFixed(2)}%`;
}

/** Signed percentage, e.g. "+14.10%" / "-13.19%". */
export function formatSignedPercent(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

/** Bare number for ratios such as P/E and EPS. */
export function formatNumber(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return plainFormatter.format(value);
}

/** Integer quantity. */
export function formatQuantity(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return new Intl.NumberFormat("en-IN").format(value);
}

/** Clock time for the "last updated" line, e.g. "14:32:07". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Sign bucket used to pick colour and glyph. Null stays neutral. */
export function trendOf(value: number | null | undefined): "up" | "down" | "flat" {
  if (!usable(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}
