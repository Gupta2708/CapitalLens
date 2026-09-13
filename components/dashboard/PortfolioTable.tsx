"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Delta } from "@/components/ui/Delta";
import {
  EM_DASH,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  formatTime,
} from "@/lib/format/currency";
import type { PortfolioHoldingView, SectorSummary } from "@/lib/finance/types";
import { useFlashOnChange } from "./useFlashOnChange";

type SortKey =
  | "name"
  | "investment"
  | "portfolioPct"
  | "cmp"
  | "presentValue"
  | "gainLoss"
  | "gainLossPct"
  | "peRatio";

type SortDirection = "asc" | "desc";

const COLUMNS: Array<{
  key: SortKey | null;
  label: string;
  align: "left" | "right";
  hint?: string;
}> = [
  { key: "name", label: "Stock", align: "left" },
  { key: null, label: "NSE/BSE", align: "left", hint: "Exchange code exactly as given in the source workbook" },
  { key: null, label: "Buy Price", align: "right" },
  { key: null, label: "Qty", align: "right" },
  { key: "investment", label: "Investment", align: "right" },
  { key: "portfolioPct", label: "Portfolio %", align: "right" },
  { key: "cmp", label: "CMP", align: "right", hint: "Current market price, live from Yahoo Finance" },
  { key: "presentValue", label: "Present Value", align: "right" },
  { key: "gainLoss", label: "Gain / Loss", align: "right" },
  { key: "gainLossPct", label: "Return %", align: "right" },
  { key: "peRatio", label: "P/E", align: "right", hint: "Trailing price/earnings ratio, from Google Finance" },
  {
    key: null,
    label: "Latest Earnings (EPS)",
    align: "right",
    hint: "Earnings per share, from Google Finance. The workbook labels this column Latest Earnings.",
  },
];

function compare(
  a: PortfolioHoldingView,
  b: PortfolioHoldingView,
  key: SortKey,
  direction: SortDirection,
): number {
  const factor = direction === "asc" ? 1 : -1;

  if (key === "name") return a.name.localeCompare(b.name) * factor;

  const left = a[key];
  const right = b[key];

  // Unpriced rows always sink to the bottom regardless of direction -- they are
  // missing data, not the worst performers.
  const leftMissing = left === null || !Number.isFinite(left);
  const rightMissing = right === null || !Number.isFinite(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  return ((left as number) - (right as number)) * factor;
}

/** A price cell that tints briefly when its value moves. */
function PriceCell({ holding }: { holding: PortfolioHoldingView }) {
  const flash = useFlashOnChange(holding.cmp);

  return (
    <td
      className={`px-3 py-2 text-right ${flash}`}
      title={holding.cmp === null ? "No live price available for this symbol" : undefined}
    >
      <span className="tnum text-text-primary">{formatPrice(holding.cmp)}</span>
      {holding.quoteFreshness === "stale" && (
        <span className="ml-1.5 align-middle">
          <Badge tone="warn" title={`Last successful fetch: ${formatTime(holding.quotedAt)}`}>
            stale
          </Badge>
        </span>
      )}
    </td>
  );
}

function HoldingRow({ holding }: { holding: PortfolioHoldingView }) {
  const valueFlash = useFlashOnChange(holding.presentValue);

  return (
    <tr className="holding-row">
      {/* Pinned identity column: the row stays identifiable while scrolling. */}
      <th
        scope="row"
        className="holding-name sticky left-0 z-10 whitespace-nowrap bg-surface-raised px-3 py-2 text-left font-medium"
      >
        {holding.name}
        {holding.pricedOnFallbackExchange && holding.pricedOn && (
          <span className="ml-1.5 align-middle">
            <Badge
              tone="accent"
              title={`Quoted on ${holding.pricedOn} because the ${holding.sourceExchange} listing did not respond`}
            >
              via {holding.pricedOn}
            </Badge>
          </span>
        )}
      </th>

      <td className="px-3 py-2 text-left">
        <span className="tnum text-xs text-text-muted">{holding.sourceExchangeCode}</span>
      </td>
      <td className="tnum px-3 py-2 text-right text-text-secondary">
        {formatPrice(holding.purchasePrice)}
      </td>
      <td className="tnum px-3 py-2 text-right text-text-secondary">
        {formatQuantity(holding.quantity)}
      </td>
      <td className="tnum px-3 py-2 text-right text-text-primary">
        {formatCurrency(holding.investment)}
      </td>
      <td className="tnum px-3 py-2 text-right text-text-secondary">
        {formatPercent(holding.portfolioPct)}
      </td>

      <PriceCell holding={holding} />

      <td className={`tnum px-3 py-2 text-right text-text-primary ${valueFlash}`}>
        {formatCurrency(holding.presentValue)}
      </td>
      <td className="px-3 py-2 text-right font-medium">
        <Delta value={holding.gainLoss} format={formatSignedCurrency} />
      </td>
      <td className="px-3 py-2 text-right">
        <Delta value={holding.gainLossPct} format={formatSignedPercent} />
      </td>
      <td
        className="tnum px-3 py-2 text-right text-text-secondary"
        title={
          holding.peRatio === null
            ? "Google Finance does not publish a P/E for this listing"
            : undefined
        }
      >
        {formatNumber(holding.peRatio)}
      </td>
      <td
        className="tnum px-3 py-2 text-right text-text-secondary"
        title={
          holding.latestEarningsEps === null
            ? "Google Finance does not publish EPS for this listing"
            : undefined
        }
      >
        {formatNumber(holding.latestEarningsEps)}
      </td>
    </tr>
  );
}

/** The banded summary row that opens each sector block. */
function SectorRow({ sector }: { sector: SectorSummary }) {
  return (
    <tr className="sector-row">
      <th
        scope="colgroup"
        className="sticky left-0 z-10 whitespace-nowrap bg-surface-band px-3 py-2.5 text-left"
      >
        <span className="text-[0.8125rem] font-semibold text-text-primary">
          {sector.name}
        </span>
        <span className="ml-2 text-[0.6875rem] text-text-muted">
          {sector.holdings.length}
          {sector.holdings.length === 1 ? " holding" : " holdings"}
        </span>
        {sector.completeness === "partial" && (
          <span className="ml-1.5 align-middle">
            <Badge
              tone="warn"
              title={`${sector.pricedHoldingsCount} of ${sector.totalHoldingsCount} holdings could be priced`}
            >
              {sector.pricedHoldingsCount}/{sector.totalHoldingsCount} priced
            </Badge>
          </span>
        )}
      </th>

      <td colSpan={3} />
      <td className="tnum px-3 py-2.5 text-right text-[0.8125rem] font-semibold text-text-primary">
        {formatCurrency(sector.totalInvestment)}
      </td>
      <td className="tnum px-3 py-2.5 text-right text-xs text-text-secondary">
        {formatPercent(
          sector.holdings.reduce((total, holding) => total + holding.portfolioPct, 0),
        )}
      </td>
      <td />
      <td className="tnum px-3 py-2.5 text-right text-[0.8125rem] font-semibold text-text-primary">
        {formatCurrency(sector.totalPresentValue)}
      </td>
      <td className="px-3 py-2.5 text-right text-[0.8125rem] font-semibold">
        <Delta value={sector.totalGainLoss} format={formatSignedCurrency} />
      </td>
      <td className="px-3 py-2.5 text-right text-[0.8125rem] font-semibold">
        <Delta value={sector.totalGainLossPct} format={formatSignedPercent} />
      </td>
      <td colSpan={2} />
    </tr>
  );
}

/**
 * The sector-grouped holdings table.
 *
 * Sorting reorders rows WITHIN each sector and never across sectors -- the
 * grouping is the structure of the portfolio, not a sort order to be discarded.
 */
export function PortfolioTable({
  sectors,
  totalHoldings,
}: {
  sectors: SectorSummary[];
  totalHoldings: number;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const visibleSectors = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sectors
      .map((sector) => {
        const filtered = needle
          ? sector.holdings.filter(
              (holding) =>
                holding.name.toLowerCase().includes(needle) ||
                holding.sourceExchangeCode.toLowerCase().includes(needle),
            )
          : sector.holdings;

        const sorted = sortKey
          ? [...filtered].sort((a, b) => compare(a, b, sortKey, sortDirection))
          : filtered;

        return { ...sector, holdings: sorted };
      })
      .filter((sector) => sector.holdings.length > 0);
  }, [sectors, query, sortKey, sortDirection]);

  const matchCount = visibleSectors.reduce(
    (total, sector) => total + sector.holdings.length,
    0,
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" ? "asc" : "desc");
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Holdings</h2>
          <p className="mt-0.5 text-[0.75rem] text-text-muted">
            {query
              ? `${matchCount} of ${totalHoldings} holdings match`
              : `${totalHoldings} holdings across ${sectors.length} sectors`}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {sortKey && (
            <button
              type="button"
              onClick={() => setSortKey(null)}
              className="text-[0.75rem] text-text-muted underline-offset-2 transition-colors hover:text-text-secondary hover:underline"
            >
              Clear sort
            </button>
          )}
          <label className="search-field relative flex items-center">
            <span className="sr-only">Search holdings</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="search-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stock or code"
              className="w-44 bg-transparent py-[0.4375rem] pl-8 pr-3 text-[0.8125rem] text-text-primary placeholder:text-text-muted sm:w-56"
            />
          </label>
        </div>
      </div>

      {/*
        This container is the table's own scroll viewport, vertical and
        horizontal. It has to be: setting `overflow-x` alone makes the vertical
        axis compute to `auto` as well, which turns the div into the sticky
        containing block -- a page-level `top` offset would then push the header
        down INSIDE the container and cover the first row. Owning both axes
        makes the behaviour explicit, pins the header to the top of the table
        rather than the page, and keeps the page itself from ever scrolling
        sideways.
      */}
      <div className="scroll-soft max-h-[70vh] min-h-[16rem] overflow-auto">
        {/*
          border-separate, not border-collapse: a collapsed border model breaks
          `position: sticky` on thead in Chrome -- the header detaches and the
          first body row renders underneath it. Spacing is zeroed so it still
          looks like a collapsed table.
        */}
        <table className="data-table w-full min-w-[1100px] border-separate border-spacing-0 text-[0.8125rem]">
          <thead className="sticky top-0 z-20 bg-surface-raised">
            <tr>
              {COLUMNS.map((column) => {
                const isSorted = column.key !== null && sortKey === column.key;
                return (
                  <th
                    key={column.label}
                    scope="col"
                    title={column.hint}
                    aria-sort={
                      isSorted
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={`label-caps whitespace-nowrap bg-surface-raised px-3 py-2.5 ${
                      column.align === "right" ? "text-right" : "text-left"
                    } ${column.label === "Stock" ? "sticky left-0 z-10" : ""}`}
                  >
                    {column.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key as SortKey)}
                        className="sort-button"
                        data-active={isSorted}
                      >
                        {column.label}
                        <span aria-hidden="true" className="sort-glyph">
                          {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleSectors.map((sector) => (
              <Fragment key={sector.name}>
                <SectorRow sector={sector} />
                {sector.holdings.map((holding) => (
                  <HoldingRow key={holding.id} holding={holding} />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>

        {matchCount === 0 && (
          <p className="px-5 py-10 text-center text-[0.8125rem] text-text-muted">
            No holdings match {`"${query}"`}.
          </p>
        )}
      </div>

      <p className="border-t border-border-subtle px-5 py-3 text-[0.75rem] leading-relaxed text-text-muted">
        {EM_DASH} indicates a value the provider did not return. Prices come from
        Yahoo Finance; P/E and EPS from Google Finance. Both are unofficial
        sources and may be delayed.
      </p>
    </section>
  );
}
