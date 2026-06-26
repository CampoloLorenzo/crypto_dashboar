import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/mongodb";
import { getMarkets, getGlobal, getTrendingIds } from "@/lib/coingecko";
import { scoreCoins } from "@/lib/scoring";
import { sendNtfy } from "@/lib/ntfy";
import { getLatestSnapshot } from "@/lib/snapshots";
import type { GlobalMarket, FearGreed, ScoredCoin, Snapshot } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMPOSITE_ALERT_THRESHOLD = 75;
const SNAPSHOT_RETENTION_DAYS = 30;

// POST /api/cron/refresh — fetch automatico, scoring, snapshot, alert.
// Protetto da CRON_SECRET (header: Authorization: Bearer <secret>).
export async function POST(req: NextRequest) {
  // 1. Auth
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "MONGODB_URI non configurata" },
      { status: 500 }
    );
  }

  try {
    const db = await getDb();

    // 2. Carica watchlist
    const watchDocs = await db.collection("watchlist").find({}).toArray();
    const watchIds = watchDocs.map((d) => String(d.coinId));

    // Snapshot precedente (per il diff opportunità).
    const prev = await getLatestSnapshot();

    // 3. Fetch in parallelo: top 50 + watchlist, global, trending, F&G.
    const [top, watchCoins, global, trendingIds, fearGreed] = await Promise.all([
      getMarkets({ perPage: 50, revalidate: 0 }),
      watchIds.length
        ? getMarkets({ ids: watchIds, perPage: 250, revalidate: 0 })
        : Promise.resolve([]),
      getGlobal(0).catch((): GlobalMarket | null => null),
      getTrendingIds(0).catch(() => [] as string[]),
      fetchFearGreed(),
    ]);

    // Unisci top + watchlist deduplicando per id.
    const byId = new Map<string, (typeof top)[number]>();
    for (const c of [...top, ...watchCoins]) byId.set(c.id, c);
    const trending = new Set(trendingIds);
    const merged = [...byId.values()].map((c) => ({
      ...c,
      trending: trending.has(c.id),
    }));

    // 4. Scoring
    const scored = scoreCoins(merged);

    // 5. Salva snapshot
    const snapshot: Snapshot = {
      timestamp: new Date().toISOString(),
      global:
        global ??
        ({
          totalMarketCap: 0,
          btcDominance: 0,
          totalVolume24h: 0,
          marketCapChange24h: 0,
        } as GlobalMarket),
      fearGreed,
      coins: scored,
    };
    const ins = await db.collection("snapshots").insertOne(snapshot as any);
    const snapshotId = String(ins.insertedId);

    // 6. Rileva opportunità emergenti (diff vs snapshot precedente)
    const opportunities = detectOpportunities(scored, prev);

    // 6b. Cambio significativo di Fear & Greed (>=15 punti)
    if (prev && Math.abs(fearGreed.value - prev.fearGreed.value) >= 15) {
      const dir = fearGreed.value > prev.fearGreed.value ? "su" : "giù";
      opportunities.push({
        type: "fear_greed_shift",
        coinId: "global",
        symbol: "MKT",
        message: `Fear & Greed da ${prev.fearGreed.value} a ${fearGreed.value} (${fearGreed.label}): sentiment in forte movimento verso l'alto/${dir}.`,
      });
    }

    // 7. Invia alert + log
    let alertsSent = 0;
    for (const opp of opportunities) {
      const ok = await sendNtfy(opp.message, {
        title: `🚀 ${opp.symbol.toUpperCase()} — ${opp.type}`,
        tags: ["chart_with_upwards_trend"],
        priority: 4,
      });
      await db.collection("alerts_log").insertOne({
        timestamp: new Date().toISOString(),
        type: opp.type,
        coinId: opp.coinId,
        message: opp.message,
        sent: ok,
      });
      if (ok) alertsSent++;
    }

    // 8. Pulizia snapshot vecchi
    const cutoff = new Date(
      Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    await db.collection("snapshots").deleteMany({ timestamp: { $lt: cutoff } });

    // 9. Risposta
    return NextResponse.json({
      success: true,
      snapshotId,
      opportunitiesFound: opportunities.length,
      alertsSent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

// Consenti anche GET per il trigger nativo Vercel cron (che usa GET).
export async function GET(req: NextRequest) {
  return POST(req);
}

// --- helper ------------------------------------------------------------------

async function fetchFearGreed(): Promise<FearGreed> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      cache: "no-store",
    });
    const raw = await res.json();
    const item = raw?.data?.[0];
    return {
      value: Number(item?.value ?? 50),
      label: item?.value_classification ?? "Neutral",
    };
  } catch {
    return { value: 50, label: "Neutral" };
  }
}

interface Opportunity {
  type: string;
  coinId: string;
  symbol: string;
  message: string;
}

function detectOpportunities(
  current: ScoredCoin[],
  prev: Snapshot | null
): Opportunity[] {
  const out: Opportunity[] = [];
  const prevById = new Map(
    (prev?.coins ?? []).map((c) => [c.id, c] as const)
  );

  for (const c of current) {
    const before = prevById.get(c.id);
    const tier = c.score.tier;

    // a) passaggio a tier emerging/momentum
    const promoted =
      (tier === "emerging" || tier === "momentum") &&
      before &&
      before.score.tier !== tier;
    if (promoted) {
      out.push({
        type: `tier:${tier}`,
        coinId: c.id,
        symbol: c.symbol,
        message: `${c.symbol.toUpperCase()} è passata a tier "${tier}" (growth ${c.score.growth}, risk ${c.score.risk}, composite ${c.score.composite}). Dato euristico, non una previsione.`,
      });
      continue;
    }

    // b) composite oltre soglia (nuovo o salito sopra la soglia)
    const crossedThreshold =
      c.score.composite >= COMPOSITE_ALERT_THRESHOLD &&
      (!before || before.score.composite < COMPOSITE_ALERT_THRESHOLD);
    if (crossedThreshold) {
      out.push({
        type: "composite_high",
        coinId: c.id,
        symbol: c.symbol,
        message: `${c.symbol.toUpperCase()} ha superato un composite di ${c.score.composite}/100 (growth ${c.score.growth}, risk ${c.score.risk}). Dato euristico, non una previsione.`,
      });
      continue;
    }

    // c) volume spike marcato vs snapshot precedente
    if (before && before.volume24h > 0) {
      const delta = (c.volume24h - before.volume24h) / before.volume24h;
      if (delta > 0.5 && c.score.signals.includes("volume_spike")) {
        out.push({
          type: "volume_spike",
          coinId: c.id,
          symbol: c.symbol,
          message: `${c.symbol.toUpperCase()}: volume 24h +${Math.round(delta * 100)}% rispetto all'ultimo snapshot.`,
        });
      }
    }
  }

  return out;
}
