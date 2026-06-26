"use client";

import { useCallback, useEffect, useState } from "react";
import type { GlobalMarket, FearGreed, ScoredCoin, Snapshot, MarketCoin } from "@/types";
import { scoreCoins } from "@/lib/scoring";
import MarketOverview from "@/components/MarketOverview";
import FearGreedGauge from "@/components/FearGreedGauge";
import OpportunityRadar from "@/components/OpportunityRadar";
import AIAssistant from "@/components/AIAssistant";
import PortfolioPanel from "@/components/PortfolioPanel";

interface DashboardData {
  coins: ScoredCoin[];
  global: GlobalMarket | null;
  fearGreed: FearGreed | null;
  timestamp: string | null;
  source: "snapshot" | "live";
}

export default function Page() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica l'ultimo snapshot dal DB. Se assente, ripiega su dati live
  // (market + sentiment) calcolando lo scoring lato client.
  const load = useCallback(async () => {
    setError(null);
    try {
      const snapRes = await fetch("/api/snapshot", { cache: "no-store" });
      const snapJson = await snapRes.json();
      const snapshot: Snapshot | null = snapJson?.snapshot ?? null;

      if (snapshot) {
        setData({
          coins: snapshot.coins,
          global: snapshot.global,
          fearGreed: snapshot.fearGreed,
          timestamp: snapshot.timestamp,
          source: "snapshot",
        });
        return;
      }

      // Fallback live (Fase 1/2 senza cron ancora configurato).
      const [marketRes, sentRes] = await Promise.all([
        fetch("/api/market?per_page=50", { cache: "no-store" }),
        fetch("/api/sentiment", { cache: "no-store" }),
      ]);
      const market = await marketRes.json();
      const sentiment = sentRes.ok ? await sentRes.json() : null;

      const liveCoins: MarketCoin[] = market?.coins ?? [];
      setData({
        coins: scoreCoins(liveCoins),
        global: market?.global ?? null,
        fearGreed: sentiment && !sentiment.error ? sentiment : null,
        timestamp: new Date().toISOString(),
        source: "live",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling ogni 60s.
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Trigger manuale del cron (richiede CRON_SECRET lato server: qui chiamiamo
  // solo il ricarico dei dati; il refresh pesante lo fa il cron).
  const [refreshing, setRefreshing] = useState(false);
  async function manualRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Crypto Intelligence</h1>
          <p className="text-xs text-slate-500">
            {data?.source === "snapshot"
              ? "Snapshot dal database"
              : "Dati live (nessuno snapshot in DB)"}
            {data?.timestamp &&
              ` · aggiornato ${new Date(data.timestamp).toLocaleTimeString("it-IT")}`}
          </p>
        </div>
        <button
          onClick={manualRefresh}
          disabled={refreshing}
          className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600
            border border-base-600 text-sm disabled:opacity-50"
        >
          {refreshing ? "Aggiorno…" : "↻ Refresh ora"}
        </button>
      </header>

      {error && (
        <div className="card p-4 text-risk text-sm">⚠️ {error}</div>
      )}

      {loading && !data ? (
        <div className="text-slate-500 text-sm">Caricamento dati…</div>
      ) : (
        <>
          <div className="grid lg:grid-cols-[1fr_280px] gap-4">
            <div className="space-y-4">
              <MarketOverview data={data?.global ?? null} />
            </div>
            <FearGreedGauge data={data?.fearGreed ?? null} />
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
            <OpportunityRadar coins={data?.coins ?? []} />
            <div className="space-y-6">
              <PortfolioPanel coins={data?.coins ?? []} />
              <AIAssistant />
            </div>
          </div>
        </>
      )}

      <footer className="pt-4 border-t border-base-700 text-xs text-slate-600">
        Strumento informativo. Gli score sono euristici, non previsioni. Nessuna
        funzionalità di trading. Non costituisce consulenza finanziaria.
      </footer>
    </main>
  );
}
