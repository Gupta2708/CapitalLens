"use client";

import { trendOf } from "@/lib/format/currency";

/**
 * Colour is never the only signal: each value also carries a glyph and an
 * explicit sign. Missing data renders muted rather than red -- "could not
 * price this" is not a loss.
 *
 * The delta-gain / delta-loss classes let a hovered row strengthen the colour
 * without this component knowing about hover.
 */
export function Delta({
  value,
  format,
  className = "",
  showGlyph = true,
}: {
  value: number | null;
  format: (value: number | null) => string;
  className?: string;
  showGlyph?: boolean;
}) {
  const trend = trendOf(value);
  const isMissing = value === null || !Number.isFinite(value);

  const colour = isMissing
    ? "text-text-muted"
    : trend === "up"
      ? "text-gain delta-gain"
      : trend === "down"
        ? "text-loss delta-loss"
        : "text-text-secondary";

  const glyph = trend === "up" ? "▲" : trend === "down" ? "▼" : null;

  return (
    <span className={`tnum inline-flex items-center gap-1 ${colour} ${className}`}>
      {showGlyph && glyph && !isMissing && (
        <span aria-hidden="true" className="text-[0.65em] leading-none">
          {glyph}
        </span>
      )}
      {format(value)}
    </span>
  );
}
