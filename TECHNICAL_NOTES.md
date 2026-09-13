# Technical Notes

The reasoning behind CapitalLens: what was built, what was decided, and what was found along the way.

---

## 1. Architecture

One Next.js application. The App Router route handler *is* the Node backend, so there is no separate
Express service to run, deploy or explain.

```
Browser
  └─ usePortfolio()  ── polls every 15s ──▶  GET /api/portfolio   (Node runtime)
                                                   │
                                     ┌─────────────┴─────────────┐
                                     ▼                           ▼
                            yahoo-provider.ts          google-finance-provider.ts
                             CMP, 15s cache              P/E + EPS, 45min cache
                                     └─────────────┬─────────────┘
                                                   ▼
                                          calculations.ts  (pure)
                                          aggregate.ts     (pure)
                                                   ▼
                                          normalized JSON + metadata
```

The layering rule: **only the two provider adapters know that Yahoo and Google exist.** Everything
downstream consumes normalized `QuoteResult` and `FundamentalsResult` values. Swapping in a different
price source means rewriting one file.

The calculation and aggregation layers are pure functions over plain data — no fetching, no React, no
dates. That is what makes them exhaustively testable without mocking anything.

## 2. Normalizing the workbook

The source sheet (`Priyanshu`) has 26 active holdings in rows 4–34, grouped into six sector blocks,
totalling **₹1,543,060** in `E35`. All three figures are asserted in `tests/holdings.test.ts` so the
data cannot drift from the source unnoticed.

Two judgement calls:

**Exited positions are excluded.** Rows 38–40 (Infy, Happiest Mind, Easemytrip) sit *below* the total
row and carry a "Sold Price" column with realised P&L of −₹12,969.63. They are closed positions;
including them would break the total and misstate the portfolio.

**The workbook's own market data is unusable.** Every price cell is a dead
`__xludf.DUMMYFUNCTION("GOOGLEFINANCE...")` stub, and the cached fundamentals are actively wrong —
Fine Organic, Gravita and Easemytrip all carry Deepak Nitrite's P/E and EPS verbatim (41.86 / 37.26),
a copy-paste artifact, while Savani and SBI Life show `#N/A`. The workbook is a source of *static
portfolio data only*. Everything market-related is fetched live.

## 3. The mixed NSE/BSE identifier problem

The sheet's `NSE/BSE` column mixes NSE tickers (`HDFCBANK`, `DMART`) with BSE numeric security codes
(`532174`, `500331`). The obvious approach — append `.NS` to everything — does not work, because a
BSE security code is not an NSE ticker.

The less obvious finding is that **no single rule works**, which I established by testing:

| Symbol | Result | Lesson |
|---|---|---|
| `532174.BO` | HTTP 404 | A BSE code is not automatically a Yahoo `.BO` symbol |
| `511577.BO` | HTTP 200, ₹21.75 | ...but sometimes it is, so you cannot rule the form out either |
| `541557.BO` | **HTTP 200, price 10,603,328,500, currency `null`, exchange `YHD`** | A 200 response can be the wrong instrument entirely |

That third row is the important one. It returns the correct company name (Fine Organic) with a
nonsense price from an unrelated exchange. Nothing structural distinguishes it from a good response.
Had it gone unnoticed it would have landed in the portfolio as a ₹1.06 × 10¹⁰ valuation and corrupted
every total above it.

The response is twofold:

1. **An explicitly mapped, individually verified symbol table.** Each of the 26 holdings carries a
   `priceSymbol` confirmed to return an INR quote on the stated exchange, plus a `fallbackPriceSymbol`
   on the other exchange.
2. **A validation guard** (`isUsableQuote`) that rejects any quote that is not INR, not on NSE or BSE,
   or not a positive finite number. Structural validity is not enough; the value has to be plausible.

**Source identity is kept separate from quote identity.** A holding carries `sourceExchangeCode` (the
workbook's own string, shown verbatim in the table), `sourceExchange`, `priceSymbol` and
`priceExchange`. Pricing prefers the holding's own exchange and falls back to the other only on
failure — and when that happens, the row is tagged in the UI. A BSE-coded holding never silently
implies a BSE quote.

**One holding had genuinely moved.** The workbook says `LTIM`, but NSE renamed the listing to `LTM`
and the company is now LTM Limited. `LTIM.NS`, `LTIM.BO` and `LTIMINDTREE.NS` all 404 today. The
source code is preserved as metadata while the quote uses `LTM.NS`. This is worth noting as a class
of problem: a stale identifier in source data looks exactly like a dead symbol until you check.

## 4. Yahoo Finance integration

`yahoo-finance2` is the obvious library choice, and I did not use it. Its quote path wraps
`v7/finance/quote`, which answers:

```
HTTP 401 — "User is unable to access this feature"
```

without a cookie-and-crumb handshake. The unauthenticated `v8/finance/chart/{symbol}` endpoint
returns everything needed in `chart.result[0].meta` — `regularMarketPrice`, `currency`,
`fullExchangeName` — and wraps in about thirty lines. Fewer moving parts, no auth dance that can
break silently, and a dependency less to justify.

Requests run through a bounded concurrency pool (8 workers) with a per-request
`AbortSignal.timeout`. 26 symbols resolve in roughly three seconds.

## 5. Google Finance integration

Google publishes no official API for P/E and EPS, so the quote page is fetched server-side and parsed
with Cheerio. All of it is confined to one module.

The parsing decision that matters: **match the visible label, not the CSS class.** The markup looks
like this:

```html
<div class="KxsRFb">
  <div class="SwQK7">P/E ratio</div>
  <div class="dO6ijd">13.84</div>
</div>
```

`SwQK7` and `dO6ijd` are build artifacts that rotate without notice. "P/E ratio" and "EPS" are
product copy and change far more rarely. The parser finds the node whose text *equals* the label and
reads its sibling. When Google eventually restructures the page, the result is `null` and an em-dash
in the UI — never a wrong number, never a crash.

Parser tests run against a saved sanitized fixture and never touch the network, so the suite is
deterministic and works offline. The fixture deliberately preserves a quirk of the live page: Google
renders duplicate mobile and desktop copies of the stats grid, so each label appears twice.

Google mapping needed none of Yahoo's care — it accepts numeric BSE codes directly, so NSE names map
to `SYM:NSE` and BSE codes to `CODE:BOM`.

**Three holdings have no P/E or EPS upstream** (including LTM after its rename, and Gensol, which is
loss-making and so has no meaningful P/E). Their pages return 18 key-stat blocks instead of 30. This
is absent source data, not a parser failure, and it is the reason the dashboard distinguishes
"unavailable" from "error".

## 6. Caching and rate limits

| Data | TTL | Reasoning |
|---|---|---|
| Quotes | 15s | Matches the refresh cadence; absorbs duplicate requests within a tick |
| Fundamentals | 45min | Quarterly data. Scraping it at price cadence is ~180× the requests for identical values |

A TTL cache alone is not enough. It prevents repeat work *after* a response lands, but does nothing
about the window *before* the first response arrives — several requests for the same symbol starting
inside that window all miss the cache and all hit the provider. At a 15-second cadence across 26
symbols, two open tabs or one slow response are enough to trigger it.

So both adapters also use an **in-flight registry**: a keyed map of pending promises that guarantees
one upstream request per symbol at a time, with every concurrent caller awaiting the same promise.
Caching and coalescing solve adjacent problems and both are needed.

The client contributes two more protections: polling never overlaps itself (the next tick is
scheduled from completion, not by a blind timer), and it suspends entirely while the tab is hidden.

The cache is a `Map` in process memory. On serverless it is per-instance and resets on cold start.
Redis is the production answer and is deliberately out of scope here.

## 7. Asynchronous strategy

Prices and fundamentals are fetched as two independent batches via `Promise.allSettled`, and each
adapter converts its own failures into null-valued results rather than throwing. Failure is contained
at three levels:

1. **Per symbol** — one bad ticker yields `null` for that row.
2. **Per provider** — a total Google outage still returns live prices, and vice versa.
3. **Per request** — the route returns HTTP 200 with partial data and metadata describing the gap.

A single unresolvable stock can never produce a 500 for the whole portfolio.

## 8. Partial valuation — the subtle correctness problem

This is the part of the implementation most worth understanding, because the bug it avoids is
invisible.

When some holdings cannot be priced, there are two different populations in play:

```
all holdings      →  totalInvestment     (the full cost basis)
priced holdings   →  totalPresentValue   (what we can actually value)
```

Computing `totalPresentValue − totalInvestment` mixes them, and silently reports every unpriced
holding as a **total loss**. With 2 of 26 holdings unpriced, the portfolio is understated by their
entire cost basis — and the number still looks perfectly reasonable, which is what makes it
dangerous.

So gain/loss subtracts `pricedInvestment`, and return divides by `pricedInvestment`. The same rule is
applied per sector. The API then exposes `pricedHoldingsCount`, `pricedInvestment`,
`valuationCoveragePct` and a `completeness` flag so the figures are self-describing, and the UI states
the coverage in plain language rather than presenting a number whose population the reader has to
guess. `tests/aggregate.test.ts` asserts the wrong answer is *not* produced.

The related rule: an unavailable price yields `null`, never `0`. Zero is a claim; null is an absence.

## 9. Graceful degradation

Handled explicitly: request failure, timeout, unresolvable symbol, implausible quote, parser
mismatch, empty field, partial provider response, and total provider outage.

The failure ladder for a quote is: fresh cache → live fetch → **expired cache entry, marked stale** →
unavailable. Preferring a known-old price over no price is usually right, but it is only safe if the
reader is told, so stale values carry a badge with their timestamp and `getStale()` must be called
explicitly — stale data can never be returned by accident.

The UI reflects data health rather than HTTP health. During a total price outage the request still
succeeds, so a status keyed off the response alone would show a confident "Live" above a table of
em-dashes. The header pill reads the provider metadata instead.

Valuation figures fall back to an em-dash when nothing is priced, rather than showing ₹0 — which
would read as "your portfolio is worthless" instead of "we could not price it".

## 10. Frontend and refresh behaviour

Skeletons appear only before the first response. Every subsequent refresh updates values in place:
nothing unmounts, nothing shifts, no spinner covers the content.

Three details make a 15-second refresh readable rather than distracting:

- **Tabular figures** (`font-variant-numeric: tabular-nums`) on every number. Proportional digits
  have different widths, so a refreshing price column visibly jitters; tabular figures hold still.
- **A brief tint on changed cells** — green up, red down, ~700ms — which shows what moved without
  moving anything, and respects `prefers-reduced-motion`.
- **Previous data survives failures**, so a transient blip never blanks the dashboard.

Colour is never the only signal: every gain/loss value pairs its colour with a ▲/▼ glyph and an
explicit sign, so the table survives greyscale and colour-vision deficiency. The chart palette was
validated for contrast and CVD separation in both themes, and deliberately omits its green and red
slots because those hues already carry gain/loss meaning on this page.

Two bugs found only by opening the page in a real browser, both worth knowing:

- `position: sticky` on `<thead>` is broken by `border-collapse` in Chrome — the header detaches and
  the first row renders beneath it. The fix is `border-separate` with zeroed spacing and borders
  moved onto the cells.
- Setting `overflow-x: auto` alone makes `overflow-y` compute to `auto` as well. That turned the
  table container into the sticky containing block, so a page-level `top` offset pushed the header
  *down inside the container*, over the first row. The container now owns both axes explicitly.

## 11. Performance

- 26 quotes in ~3s cold, served from cache within a 15-second tick.
- Fundamentals are fetched once per 45 minutes and shared across every refresh.
- Bounded concurrency (8 for Yahoo, 4 for Google) keeps the request burst civil.
- The payload is ~27 KB of JSON.
- The client re-renders from a single state object; sorting and filtering are memoized.

## 12. What I would do differently in production

| Area | Change |
|---|---|
| Caching | Redis or another shared cache, so the TTL survives cold starts and is shared across instances |
| Price feed | A paid, licensed market-data API. Unofficial endpoints are fine for an assignment and unacceptable for anything that matters |
| Parser safety | Alerting when the Google parser starts returning null at an unusual rate — silent degradation is the real risk with scraping |
| Transport | Server-Sent Events or WebSockets instead of polling, once the update rate justifies it |
| Holdings | A real store with transaction history, which is what corporate-action-correct cost basis actually requires |
| Resilience | Retry with exponential backoff and a circuit breaker per provider |
| Observability | Structured logs and metrics on provider latency, error rate and cache hit rate |
| Testing | A contract test against recorded provider fixtures, to catch upstream shape changes in CI |

## 13. Verification performed

```
npm run lint       ✓
npm run typecheck  ✓
npm test           ✓  88 tests
npm run build      ✓
```

Data checks: 26 holdings, 6 sectors, ₹1,543,060 total — all asserted in tests. Sector investments sum
to the portfolio total.

Runtime checks against a live server:

- All 26 holdings priced; no `NaN`, `Infinity` or `undefined` anywhere in the payload or the DOM.
- LTM returns a live price with unavailable fundamentals — field-level degradation, exercised for
  real rather than simulated.
- With Yahoo pointed at an unreachable host: HTTP 200, cost basis and Google fundamentals intact,
  valuation figures shown as em-dashes, coverage reported as 0%, gain/loss `0` rather than
  −₹1,543,060.
- Verified visually at 1512px and 390px, in both themes, and while scrolled with the sticky header
  engaged.
