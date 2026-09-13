"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Delta } from "@/components/ui/Delta";
import {
  formatCompactCurrency,
  formatCurrency,
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
 *
 * Hovering either the donut or a legend row highlights the other. That link is
 * what turns two adjacent displays into one readable object.
 */
const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

interface SliceDatum {
  name: string;
  value: number;
  share: number;
  returnPct: number | null;
  colour: string;
}

export function AllocationChart({ sectors }: { sectors: SectorSummary[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalInvestment = sectors.reduce(
    (total, sector) => total + sector.totalInvestment,
    0,
  );

  const data: SliceDatum[] = sectors.map((sector, index) => ({
    name: sector.name,
    value: sector.totalInvestment,
    share: totalInvestment > 0 ? sector.totalInvestment / totalInvestment : 0,
    returnPct: sector.pricedHoldingsCount > 0 ? sector.totalGainLossPct : null,
    colour: SERIES_VARS[index % SERIES_VARS.length],
  }));

  const active = activeIndex === null ? null : data[activeIndex];

  return (
    <section className="card p-5">
      <h2 className="label-caps">Sector Allocation</h2>

      <div className="mt-3.5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className="relative mx-auto h-[164px] w-[164px] shrink-0"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={53}
                outerRadius={78}
                /* 2px of surface between slices, per the mark spec. */
                paddingAngle={2}
                stroke="var(--surface-1)"
                strokeWidth={2}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                /* One draw on mount, then never again -- a chart that
                   re-animates on every 15s poll is unreadable. */
                isAnimationActive
                animationDuration={520}
                animationBegin={0}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={entry.colour}
                    className={activeIndex === index ? "slice-active" : undefined}
                    opacity={
                      activeIndex === null || activeIndex === index ? 1 : 0.42
                    }
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centre of the donut: the total, or details of the hovered slice.
              Swapping content in place avoids a floating tooltip that would
              cover the very slices the reader is comparing. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            {active ? (
              <>
                <span className="max-w-full truncate text-[0.6875rem] font-medium text-text-secondary">
                  {active.name}
                </span>
                <span className="tnum mt-0.5 text-[0.9375rem] font-semibold leading-none text-text-primary">
                  {formatCompactCurrency(active.value)}
                </span>
                <span className="tnum mt-1 text-[0.6875rem] text-text-muted">
                  {formatPercent(active.share)} of book
                </span>
                <span className="mt-0.5 text-[0.6875rem]">
                  <Delta value={active.returnPct} format={formatSignedPercent} />
                </span>
              </>
            ) : (
              <>
                <span className="label-caps text-[0.625rem]">Invested</span>
                <span className="tnum text-base font-semibold text-text-primary">
                  {formatCompactCurrency(totalInvestment)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Direct labels -- the relief that makes the light palette legible,
            and the other half of the linked hover. */}
        <ul className="min-w-0 flex-1 space-y-0.5">
          {data.map((entry, index) => (
            <li
              key={entry.name}
              className="legend-row flex items-center gap-2.5 px-1.5 py-1 text-[0.8125rem]"
              data-active={activeIndex === index}
              data-dimmed={activeIndex !== null && activeIndex !== index}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span
                aria-hidden="true"
                className="legend-swatch h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: entry.colour }}
              />
              <span className="min-w-0 flex-1 truncate text-text-secondary">
                {entry.name}
              </span>
              <span
                className="tnum shrink-0 font-medium text-text-primary"
                title={`${formatCurrency(entry.value)} invested`}
              >
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
