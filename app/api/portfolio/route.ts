import { NextResponse } from "next/server";
import { buildPortfolio } from "@/lib/portfolio/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A cold request fans out to 26 Yahoo quotes and 26 Google Finance pages and
 * takes roughly 20 seconds; warm requests settle to ~3s. The 10s platform
 * default would 504 on the first request after every cold start.
 */
export const maxDuration = 60;

/**
 * The provider adapters normalize their own failures into null values, so a
 * partial outage returns 200 with metadata describing the gap. The catch here
 * is only for an unexpected crash.
 */
export async function GET() {
  try {
    const portfolio = await buildPortfolio();

    return NextResponse.json(portfolio, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to build portfolio", detail: message },
      { status: 500 },
    );
  }
}
