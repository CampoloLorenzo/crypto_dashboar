import { NextRequest, NextResponse } from "next/server";
import { getMarkets, getGlobal, getTrendingIds } from "@/lib/coingecko";

// Cache della route per 90s — più il revalidate interno del wrapper — per non
// superare il rate limit del free tier CoinGecko.
export const revalidate = 90;
export const runtime = "nodejs";

// GET /api/market — dati di mercato live (proxy CoinGecko con cache).
// Query: ?per_page=50  -> top coin per market cap + global + trending flag
export async function GET(req: NextRequest) {
  const perPage = Number(
    req.nextUrl.searchParams.get("per_page") ?? "50"
  );

  try {
    const [coins, global, trendingIds] = await Promise.all([
      getMarkets({ perPage: Math.min(Math.max(perPage, 1), 250) }),
      getGlobal().catch(() => null),
      getTrendingIds().catch(() => [] as string[]),
    ]);

    const trending = new Set(trendingIds);
    const enriched = coins.map((c) => ({
      ...c,
      trending: trending.has(c.id),
    }));

    return NextResponse.json({ coins: enriched, global });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    // Degrada con eleganza: 503 così il client può ritentare/mostrare fallback.
    return NextResponse.json(
      { error: `CoinGecko non disponibile: ${msg}`, coins: [], global: null },
      { status: 503 }
    );
  }
}
