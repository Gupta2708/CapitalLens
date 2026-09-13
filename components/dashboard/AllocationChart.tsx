"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Delta } from "@/components/ui/Delta";
import {
  formatCompactCurrency,
  formatPercent,
  formatSignedPercent,
} from "@/lib/format/currency";
import type { SectorSummary } from "@/lib/finance/types";

/**
 * Sector allocation.
 *
 * Form: a part-to-whole split across six categories, so a donut is the honest
 * shape -- the reader is asking "how is the money divided", not "rank these".
 *
 * The legend is not decoration. Three of the light-mode series colours fall
 * below 3:1 contrast on white, so the palette carries a relief obligation:
 * identity must be readable without relying on the swatch. Every slice is
 * therefore directly labelled with its name, weight and return, and the
 * sector table below is the full table view of the same numbers.
 *
 * Colour encodes sector identity only. Return is encoded separately, in the
 * gain/loss tokens with a glyph, so the two meanings never collide in one mark.
 */
const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

export function AllocationChart({ sectors }: { sectors: SectorSummary[] }) {
  const totalInvestment = sectors.reduce(
    (total, sector) => total + sector.totalInvestment,
    0,
  );

  const data = sectors.map((sector, index) => ({
    name: sector.name,
    value: sector.totalInvestment,
    share: totalInvestment > 0 ? sector.totalInvestment / totalInvestment : 0,
    returnPct: sector.pricedHoldingsCount > 0 ? sector.totalGainLossPct : null,
    colour: SERIES_VARS[index % SERIES_VARS.length],
  }));

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      <h2 className="label-caps">Sector Allocation</h2>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-[168px] w-[168px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={82}
                /* 2px of surface between slices, per the mark spec. */
                paddingAngle={2}
                stroke="var(--surface-raised)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.colour} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Hero number in the hole: the figure the donut is a breakdown of. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="label-caps text-[0.625rem]">Invested</span>
            <span className="tnum text-base font-semibold text-text-primary">
              {formatCompactCurrency(totalInvestment)}
            </span>
          </div>
        </div>

        {/* Direct labels -- the relief that makes the light palette legible. */}
        <ul className="min-w-0 flex-1 space-y-1.5">
          {data.map((entry) => (
            <li key={entry.name} className="flex items-center gap-2.5 text-xs">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: entry.colour }}
              />
              <span className="min-w-0 flex-1 truncate text-text-secondary">
                {entry.name}
              </span>
              <span className="tnum shrink-0 font-medium text-text-primary">
                {formatPercent(entry.share)}
              </span>
              <span className="shrink-0 text-right" style={{ minWidth: "4.25rem" }}>
                <Delta value={entry.returnPct} format={formatSignedPercent} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
