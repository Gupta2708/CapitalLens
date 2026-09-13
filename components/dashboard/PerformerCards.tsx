"use client";

import { Delta } from "@/components/ui/Delta";
import {
  formatSignedCurrency,
  formatSignedPercent,
  trendOf,
} from "@/lib/format/currency";
import type { PortfolioHoldingView } from "@/lib/finance/types";

function PerformerRow({
  caption,
  holding,
  /** Largest absolute return among the two, used to scale the bars. */
  scale,
}: {
  caption: string;
  holding: PortfolioHoldingView | null;
  scale: number;
}) {
  const pct = holding?.gainLossPct ?? null;
  const trend = trendOf(pct);

  // Scaled against the larger mover so the two rows are comparable.
  const width =
    pct === null || scale === 0
      ? 0
      : Math.min(100, (Math.abs(pct) / scale) * 100);

  return (
    <div className="mover-row row-interactive px-2 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-[0.6875rem]">{caption}</p>
          <p className="mover-name truncate text-[0.875rem] font-medium text-text-secondary">
            {holding?.name ?? "—"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.875rem] font-semibold">
            <Delta value={pct} format={formatSignedPercent} />
          </p>
          <p className="tnum text-[0.75rem] text-text-muted">
            {holding ? formatSignedCurrency(holding.gainLoss) : "—"}
          </p>
        </div>
      </div>

      {/* Capped short of the card width; at full bleed it reads as an
          underline on the name rather than as data. */}
      <div
        className="mt-2 h-[2px] w-full max-w-[8.5rem] overflow-hidden rounded-full bg-surface-hover"
        aria-hidden="true"
      >
        <div
          className="mover-bar"
          style={{
            width: `${width}%`,
            backgroundColor:
              trend === "up"
                ? "var(--gain)"
                : trend === "down"
                  ? "var(--loss)"
                  : "var(--border-strong)",
          }}
        />
      </div>
    </div>
  );
}

/** Ranked over priced holdings only; unpriced rows are absent, not last. */
export function PerformerCards({
  best,
  worst,
}: {
  best: PortfolioHoldingView | null;
  worst: PortfolioHoldingView | null;
}) {
  const scale = Math.max(
    Math.abs(best?.gainLossPct ?? 0),
    Math.abs(worst?.gainLossPct ?? 0),
  );

  return (
    <section className="card flex h-full flex-col p-5">
      <h2 className="label-caps">Movers</h2>
      <div className="mt-1.5 divide-y divide-border-subtle">
        <PerformerRow caption="Best performer" holding={best} scale={scale} />
        <PerformerRow caption="Worst performer" holding={worst} scale={scale} />
      </div>
    </section>
  );
}
