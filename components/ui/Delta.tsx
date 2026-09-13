"use client";

import { trendOf } from "@/lib/format/currency";

/**
 * Renders a gain/loss value.
 *
 * Colour is never the only signal: every value also carries a directional
 * glyph and an explicit sign, so the table stays readable in greyscale and for
 * readers with colour-vision deficiency. Missing data renders muted, never red,
 * because "we could not price this" is not a loss.
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
      ? "text-gain"
      : trend === "down"
        ? "text-loss"
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
