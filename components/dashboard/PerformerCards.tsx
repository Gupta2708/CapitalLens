"use client";

import { Delta } from "@/components/ui/Delta";
import {
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/format/currency";
import type { PortfolioHoldingView } from "@/lib/finance/types";

function PerformerRow({
  caption,
  holding,
}: {
  caption: string;
  holding: PortfolioHoldingView | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="label-caps text-[0.625rem]">{caption}</p>
        <p className="truncate text-sm font-medium text-text-primary">
          {holding?.name ?? "—"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">
          <Delta value={holding?.gainLossPct ?? null} format={formatSignedPercent} />
        </p>
        <p className="tnum text-[0.6875rem] text-text-muted">
          {holding ? formatSignedCurrency(holding.gainLoss) : "—"}
        </p>
      </div>
    </div>
  );
}

/**
 * Best and worst holding by return.
 *
 * Both are ranked over priced holdings only. An unpriced holding is absent from
 * the ranking rather than sorting to the bottom as if it had lost everything.
 */
export function PerformerCards({
  best,
  worst,
}: {
  best: PortfolioHoldingView | null;
  worst: PortfolioHoldingView | null;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      <h2 className="label-caps">Movers</h2>
      <div className="mt-2 divide-y divide-border-subtle">
        <PerformerRow caption="Best performer" holding={best} />
        <PerformerRow caption="Worst performer" holding={worst} />
      </div>
    </section>
  );
}
