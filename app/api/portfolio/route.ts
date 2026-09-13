import { NextResponse } from "next/server";
import { buildPortfolio } from "@/lib/portfolio/build";

/**
 * GET /api/portfolio
 *
 * The single backend endpoint. Runs on the Node runtime because the providers
 * need real timeouts and the HTML parser needs Node APIs.
 *
 * This route deliberately has no try/catch around individual providers -- the
 * adapters already normalize their own failures into null values, so a partial
 * outage returns HTTP 200 with partial data plus metadata describing the gap.
 * The catch below is only for a genuinely unexpected crash.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serverless timeout headroom.
 *
 * A cold request fans out to 26 Yahoo quotes and 26 Google Finance pages and
 * takes roughly 20 seconds; once the caches are warm it settles to ~3s. The
 * platform default of 10s would therefore 504 on the first request after every
 * cold start -- which on a low-traffic deployment is most requests.
 *
 * 60s is the ceiling on Vercel's Hobby tier and is deliberate headroom, not an
 * expected duration. The per-request AbortSignal timeouts inside the providers
 * (8s Yahoo, 10s Google) remain the real limit on how long any single upstream
 * call can hang.
 */
export const maxDuration = 60;

export async function GET() {
  try {
    const portfolio = await buildPortfolio();

    return NextResponse.json(portfolio, {
      headers: {
        // The client polls on its own schedule; never serve this from a CDN.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to build portfolio", detail: message },
      { status: 500 },
    );
  }
}
