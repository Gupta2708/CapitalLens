/**
 * The single place where a number becomes text, which is what keeps "NaN" and
 * "undefined" off the screen. Every formatter is null-safe.
 *
 * Grouping uses `en-IN`, so values carry true Indian digit grouping
 * (15,43,060 rather than 1,543,060).
 */

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

/** e.g. "₹15,43,060" */
export function formatCurrency(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return inrFormatter.format(value);
}

/** e.g. "₹1,700.15" */
export function formatPrice(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return inrPreciseFormatter.format(value);
}

/** e.g. "+₹10,508" / "-₹8,644" */
export function formatSignedCurrency(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inrFormatter.format(Math.abs(value))}`;
}

/** "₹15.43L" / "₹1.20Cr"; falls back to full formatting below one lakh. */
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

/** Takes a fraction: 0.1410 -> "14.10%". */
export function formatPercent(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return `${(value * 100).toFixed(2)}%`;
}

/** e.g. "+14.10%" / "-13.19%" */
export function formatSignedPercent(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

/** For ratios such as P/E and EPS. */
export function formatNumber(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return plainFormatter.format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  if (!usable(value)) return EM_DASH;
  return new Intl.NumberFormat("en-IN").format(value);
}

/** e.g. "14:32:07" */
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

/** Picks colour and glyph; null stays neutral. */
export function trendOf(value: number | null | undefined): "up" | "down" | "flat" {
  if (!usable(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}
