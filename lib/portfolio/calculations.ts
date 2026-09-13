/**
 * Pure per-holding arithmetic.
 *
 * Every function here is total: given any input, it returns a number or null,
 * never NaN and never Infinity. That guarantee is what keeps those three
 * strings off the dashboard, so the guards below are load-bearing rather than
 * defensive noise.
 */

/** True only for real, finite numbers. Rejects NaN, +/-Infinity, null. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Division that refuses to produce NaN or Infinity.
 * Returns null when either operand is unusable or the denominator is zero.
 */
export function safeDivide(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** investment = purchasePrice * quantity */
export function investment(purchasePrice: number, quantity: number): number {
  if (!isFiniteNumber(purchasePrice) || !isFiniteNumber(quantity)) return 0;
  return purchasePrice * quantity;
}

/**
 * portfolioPct = investment / totalInvestment
 *
 * Returned as a fraction (0.0483), not a display percentage (4.83). Formatting
 * multiplies by 100 at the edge so the raw value stays composable.
 */
export function portfolioPct(
  holdingInvestment: number,
  totalInvestment: number,
): number {
  return safeDivide(holdingInvestment, totalInvestment) ?? 0;
}

/**
 * presentValue = cmp * quantity
 *
 * Null CMP yields null -- NOT zero. Coercing an unavailable price to zero would
 * report a 100% loss on a position we simply could not price.
 */
export function presentValue(
  cmp: number | null,
  quantity: number,
): number | null {
  if (!isFiniteNumber(cmp) || !isFiniteNumber(quantity)) return null;
  return cmp * quantity;
}

/** gainLoss = presentValue - investment. Null propagates. */
export function gainLoss(
  holdingPresentValue: number | null,
  holdingInvestment: number,
): number | null {
  if (!isFiniteNumber(holdingPresentValue)) return null;
  if (!isFiniteNumber(holdingInvestment)) return null;
  return holdingPresentValue - holdingInvestment;
}

/** gainLossPct = gainLoss / investment, as a fraction. Null propagates. */
export function gainLossPct(
  holdingGainLoss: number | null,
  holdingInvestment: number,
): number | null {
  if (!isFiniteNumber(holdingGainLoss)) return null;
  return safeDivide(holdingGainLoss, holdingInvestment);
}

/**
 * Parses a numeric value out of provider text such as "13.84", "Rs.51.21",
 * "1,234.5" or "-4.60". Returns null for placeholders like "-", "N/A" or "".
 *
 * External data is never trusted straight into arithmetic; this is the single
 * choke point where provider strings become numbers.
 */
export function parseProviderNumber(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;

  // Strip currency symbols, thousands separators and whitespace, but keep the
  // sign and decimal point.
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
