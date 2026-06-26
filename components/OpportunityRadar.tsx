"use client";

import { useMemo, useState } from "react";
import type { ScoredCoin, Tier } from "@/types";
import { SIGNAL_LABELS } from "@/lib/scoring";
import CoinChart from "./CoinChart";

const TIER_META: Record<Tier, { label: string; bg: string; text: string }> = {
  emerging: { label: "Emerging", bg: "bg-tier-emerging/20", text: "text-tier-emerging" },
  momentum: { label: "Momentum", bg: "bg-tier-momentum/20", text: "text-tier-momentum" },
  stable: { label: "Stable", bg: "bg-tier-stable/20", text: "text-tier-stable" },
  caution: { label: "Caution", bg: "bg-tier-caution/20", text: "text-tier-caution" },
};

function Bar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-slate-200">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-base-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Card({ coin }: { coin: ScoredCoin }) {
  const t = TIER_META[coin.score.tier];
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {coin.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coin.image} alt="" className="w-7 h-7 rounded-full" />
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{coin.name}</div>
            <div className="text-xs text-slate-500 uppercase">
              {coin.symbol}
            </div>
          </div>
        </div>
        <span className={`chip ${t.bg} ${t.text} border-0`}>{t.label}</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Composite</div>
          <div className="text-3xl font-bold leading-none">
            {coin.score.composite}
          </div>
        </div>
        <CoinChart data={coin.sparkline7d} />
      </div>

      <div className="space-y-2">
        <Bar value={coin.score.growth} color="#22c55e" label="Growth" />
        <Bar value={coin.score.risk} color="#ef4444" label="Risk" />
      </div>

      {coin.score.signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {coin.score.signals.map((s) => (
            <span key={s} className="chip">
              {SIGNAL_LABELS[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-base-700">
        <span>€{coin.price.toLocaleString("it-IT", { maximumFractionDigits: 6 })}</span>
        <span className={coin.change24h >= 0 ? "text-growth" : "text-risk"}>
          {coin.change24h >= 0 ? "+" : ""}
          {coin.change24h.toFixed(1)}% 24h
        </span>
      </div>
    </div>
  );
}

export default function OpportunityRadar({
  coins,
}: {
  coins: ScoredCoin[];
}) {
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [maxRisk, setMaxRisk] = useState(100);
  const [showStable, setShowStable] = useState(false);

  const stableCount = useMemo(
    () => coins.filter((c) => c.isStablecoin).length,
    [coins]
  );

  const filtered = useMemo(() => {
    return coins
      .filter((c) => showStable || !c.isStablecoin)
      .filter((c) => tierFilter === "all" || c.score.tier === tierFilter)
      .filter((c) => c.score.risk <= maxRisk)
      .sort((a, b) => b.score.composite - a.score.composite);
  }, [coins, tierFilter, maxRisk, showStable]);

  const tiers: (Tier | "all")[] = [
    "all",
    "emerging",
    "momentum",
    "stable",
    "caution",
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Opportunity Radar</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {tiers.map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  tierFilter === t
                    ? "bg-base-600 border-slate-500 text-white"
                    : "bg-base-800 border-base-600 text-slate-400 hover:text-slate-200"
                }`}
              >
                {t === "all" ? "Tutti" : TIER_META[t].label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Rischio max
            <input
              type="range"
              min={0}
              max={100}
              value={maxRisk}
              onChange={(e) => setMaxRisk(Number(e.target.value))}
              className="accent-risk"
            />
            <span className="font-mono w-7 text-right">{maxRisk}</span>
          </label>
          {stableCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={showStable}
                onChange={(e) => setShowStable(e.target.checked)}
                className="accent-tier-stable"
              />
              Stablecoin ({stableCount})
            </label>
          )}
        </div>
      </div>

      <p className="text-xs text-amber-500/80">
        ⚠️ Lo scoring growth/risk/composite è <strong>euristico e informativo</strong>,
        NON una previsione. Non è consulenza finanziaria.
      </p>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-slate-500 text-sm">
          Nessuna coin corrisponde ai filtri.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} coin={c} />
          ))}
        </div>
      )}
    </section>
  );
}
