import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractLabelledStat,
  parseFundamentalsHtml,
} from "@/lib/finance/google-finance-provider";

/**
 * Parser tests run entirely against a saved fixture. They never touch
 * google.com, so the suite stays deterministic and works offline.
 *
 * The fixture is a real sanitized excerpt of the key-stats block from
 * google.com/finance/quote/HDFCBANK:NSE.
 */
const fixture = readFileSync(
  join(__dirname, "fixtures", "google-finance-stats.html"),
  "utf8",
);

describe("extractLabelledStat", () => {
  it("finds a stat by its visible label", () => {
    expect(extractLabelledStat(fixture, "P/E ratio")).toBe("13.84");
  });

  it("finds EPS", () => {
    expect(extractLabelledStat(fixture, "EPS")).toBe("₹51.21");
  });

  it("does not confuse a prefix for a full label", () => {
    // "EPS" must not match "Ex-dividend date" and "P/E ratio" must not be
    // satisfied by some other node that merely contains the text.
    expect(extractLabelledStat(fixture, "Open")).toBe("₹683.90");
  });

  it("returns null for a label that is not present", () => {
    expect(extractLabelledStat(fixture, "Free cash flow")).toBeNull();
  });

  it("takes the first match when Google renders duplicate blocks", () => {
    // The live page emits mobile and desktop copies of the stats grid, so the
    // same label appears more than once. Both carry the same value.
    expect(extractLabelledStat(fixture, "52-wk high")).toBe("₹1,020.50");
  });
});

describe("parseFundamentalsHtml", () => {
  it("extracts and normalizes both figures", () => {
    expect(parseFundamentalsHtml(fixture)).toEqual({
      peRatio: 13.84,
      latestEarningsEps: 51.21,
    });
  });

  it("returns nulls -- not zeros -- when the markup no longer matches", () => {
    // Simulates Google reshuffling its DOM. The correct outcome is degraded
    // data that the UI shows as an em-dash, never a fabricated 0.
    const changed = "<div><span>P/E ratio</span><span>13.84</span></div>";
    expect(parseFundamentalsHtml(changed)).toEqual({
      peRatio: null,
      latestEarningsEps: null,
    });
  });

  it("returns nulls for a page with no stats block", () => {
    // This is the live LTM (renamed LTIMindtree) case: the page loads fine but
    // Google has not populated its key stats.
    const empty = "<html><body><h1>LTM Ltd</h1></body></html>";
    expect(parseFundamentalsHtml(empty)).toEqual({
      peRatio: null,
      latestEarningsEps: null,
    });
  });

  it("handles a negative EPS", () => {
    const negative =
      '<div class="KxsRFb"><div>EPS</div><div>-₹4.60</div></div>';
    expect(parseFundamentalsHtml(negative).latestEarningsEps).toBe(-4.6);
  });

  it("treats a dash placeholder as missing", () => {
    const placeholder =
      '<div class="KxsRFb"><div>P/E ratio</div><div>-</div></div>';
    expect(parseFundamentalsHtml(placeholder).peRatio).toBeNull();
  });
});
