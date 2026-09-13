/**
 * Pure per-holding arithmetic. Every function returns a number or null, never
 * NaN or Infinity, which is what keeps those strings off the dashboard.
 */

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function safeDivide(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

export function investment(purchasePrice: number, quantity: number): number {
  if (!isFiniteNumber(purchasePrice) || !isFiniteNumber(quantity)) return 0;
  return purchasePrice * quantity;
}

/** Returned as a fraction (0.0483), not a display percentage. */
export function portfolioPct(
  holdingInvestment: number,
  totalInvestment: number,
): number {
  return safeDivide(holdingInvestment, totalInvestment) ?? 0;
}

/**
 * Null CMP yields null, never zero. Coercing an unavailable price to zero
 * would report a 100% loss on a position we simply could not price.
 */
export function presentValue(
  cmp: number | null,
  quantity: number,
): number | null {
  if (!isFiniteNumber(cmp) || !isFiniteNumber(quantity)) return null;
  return cmp * quantity;
}

export function gainLoss(
  holdingPresentValue: number | null,
  holdingInvestment: number,
): number | null {
  if (!isFiniteNumber(holdingPresentValue)) return null;
  if (!isFiniteNumber(holdingInvestment)) return null;
  return holdingPresentValue - holdingInvestment;
}

export function gainLossPct(
  holdingGainLoss: number | null,
  holdingInvestment: number,
): number | null {
  if (!isFiniteNumber(holdingGainLoss)) return null;
  return safeDivide(holdingGainLoss, holdingInvestment);
}

/**
 * The single point where provider strings become numbers. Handles "13.84",
 * "Rs.51.21", "1,234.5" and "-4.60"; returns null for placeholders like "-".
 */
export function parseProviderNumber(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
