"use client";

import type { GlobalMarket } from "@/types";

function fmtEur(n: number): string {
  if (n >= 1e12) return `€${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `€${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `€${(n / 1e6).toFixed(2)}M`;
  return `€${Math.round(n).toLocaleString("it-IT")}`;
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "up" | "down";
}) {
  const color =
    tone === "up"
      ? "text-growth"
      : tone === "down"
      ? "text-risk"
      : "text-slate-100";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function MarketOverview({
  data,
}: {
  data: GlobalMarket | null;
}) {
  if (!data) {
    return (
      <div className="card p-4 text-slate-500 text-sm">
        Dati di mercato globali non disponibili.
      </div>
    );
  }

  // Euristica altseason: dominance BTC bassa => possibile fase altcoin.
  const altseason =
    data.btcDominance < 45
      ? "Possibile fase altcoin"
      : data.btcDominance > 55
      ? "BTC-dominante"
      : "Equilibrato";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat label="Market cap totale" value={fmtEur(data.totalMarketCap)} />
      <Stat
        label="Var. mcap 24h"
        value={`${data.marketCapChange24h >= 0 ? "+" : ""}${data.marketCapChange24h.toFixed(2)}%`}
        tone={data.marketCapChange24h >= 0 ? "up" : "down"}
      />
      <Stat
        label="BTC dominance"
        value={`${data.btcDominance.toFixed(1)}%`}
        hint={altseason}
      />
      <Stat label="Volume 24h" value={fmtEur(data.totalVolume24h)} />
    </div>
  );
}
