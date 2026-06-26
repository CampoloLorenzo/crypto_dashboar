"use client";

import { useEffect, useMemo, useState } from "react";
import type { Position, ScoredCoin } from "@/types";

interface Props {
  coins: ScoredCoin[]; // serve per i prezzi live correnti
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
}

// Trova il prezzo corrente di un asset (match per simbolo o id).
function priceOf(asset: string, coins: ScoredCoin[]): number | null {
  const a = asset.trim().toLowerCase();
  const hit = coins.find(
    (c) => c.symbol.toLowerCase() === a || c.id.toLowerCase() === a
  );
  return hit ? hit.price : null;
}

export default function PortfolioPanel({ coins }: Props) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [dbOff, setDbOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ asset: "", qty: "", buyPrice: "", notes: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/positions", { cache: "no-store" });
      if (res.status === 503) {
        setDbOff(true);
        return;
      }
      const data = await res.json();
      setPositions(data.items ?? []);
    } catch {
      /* degrada in silenzio */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return positions.map((p) => {
      const current = priceOf(p.asset, coins);
      const cost = p.qty * p.buyPrice;
      const value = current !== null ? p.qty * current : null;
      const pnl = value !== null ? value - cost : null;
      const pnlPct = value !== null && cost > 0 ? (pnl! / cost) * 100 : null;
      return { p, current, cost, value, pnl, pnlPct };
    });
  }, [positions, coins]);

  const totals = useMemo(() => {
    let cost = 0;
    let value = 0;
    let known = false;
    for (const r of rows) {
      cost += r.cost;
      if (r.value !== null) {
        value += r.value;
        known = true;
      }
    }
    const pnl = known ? value - cost : null;
    const pnlPct = known && cost > 0 ? (pnl! / cost) * 100 : null;
    return { cost, value, pnl, pnlPct, known };
  }, [rows]);

  async function addPosition(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: form.asset,
          qty: Number(form.qty),
          buyPrice: Number(form.buyPrice),
          notes: form.notes || undefined,
        }),
      });
      setForm({ asset: "", qty: "", buyPrice: "", notes: "" });
      setShowAdd(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function logDecision(asset: string, action: "buy" | "sell" | "hold" | "watch") {
    const rationale = window.prompt(`Motivazione per "${action}" su ${asset}:`) ?? "";
    await fetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset,
        action,
        rationale,
        marketContext: { price: priceOf(asset, coins) },
      }),
    });
  }

  async function remove(id?: string) {
    if (!id) return;
    await fetch(`/api/positions?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (dbOff) {
    return (
      <div className="card p-4">
        <h2 className="font-semibold mb-1">Portafoglio</h2>
        <p className="text-sm text-slate-500">
          Configura <code className="text-slate-400">MONGODB_URI</code> per
          salvare posizioni e decisioni.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Portafoglio</h2>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="text-xs px-2.5 py-1 rounded-md bg-base-700 hover:bg-base-600 border border-base-600"
        >
          {showAdd ? "Annulla" : "+ Posizione"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addPosition} className="grid grid-cols-2 gap-2 text-sm">
          <input
            required
            placeholder="Asset (es. BTC)"
            value={form.asset}
            onChange={(e) => setForm({ ...form, asset: e.target.value })}
            className="bg-base-900 border border-base-600 rounded px-2 py-1"
          />
          <input
            required
            type="number"
            step="any"
            placeholder="Quantità"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
            className="bg-base-900 border border-base-600 rounded px-2 py-1"
          />
          <input
            required
            type="number"
            step="any"
            placeholder="Prezzo acquisto €"
            value={form.buyPrice}
            onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
            className="bg-base-900 border border-base-600 rounded px-2 py-1"
          />
          <input
            placeholder="Note (opz.)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="bg-base-900 border border-base-600 rounded px-2 py-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="col-span-2 py-1.5 rounded bg-tier-momentum text-white disabled:opacity-50"
          >
            Salva posizione
          </button>
        </form>
      )}

      {/* Totali */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-base-900 rounded-lg py-2">
          <div className="text-[10px] uppercase text-slate-500">Costo</div>
          <div className="text-sm font-semibold">{fmtEur(totals.cost)}</div>
        </div>
        <div className="bg-base-900 rounded-lg py-2">
          <div className="text-[10px] uppercase text-slate-500">Valore</div>
          <div className="text-sm font-semibold">
            {totals.known ? fmtEur(totals.value) : "—"}
          </div>
        </div>
        <div className="bg-base-900 rounded-lg py-2">
          <div className="text-[10px] uppercase text-slate-500">P&amp;L</div>
          <div
            className={`text-sm font-semibold ${
              totals.pnl === null
                ? "text-slate-400"
                : totals.pnl >= 0
                ? "text-growth"
                : "text-risk"
            }`}
          >
            {totals.pnl === null
              ? "—"
              : `${totals.pnl >= 0 ? "+" : ""}${fmtEur(totals.pnl)} (${totals.pnlPct!.toFixed(1)}%)`}
          </div>
        </div>
      </div>

      {/* Righe */}
      {loading ? (
        <p className="text-sm text-slate-500">Caricamento…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuna posizione. Aggiungine una.</p>
      ) : (
        <ul className="divide-y divide-base-700">
          {rows.map((r) => (
            <li key={r.p._id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium uppercase text-sm">{r.p.asset}</div>
                <div className="text-xs text-slate-500">
                  {r.p.qty} @ {fmtEur(r.p.buyPrice)}
                  {r.current !== null && ` · ora ${fmtEur(r.current)}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`text-sm text-right ${
                    r.pnl === null
                      ? "text-slate-400"
                      : r.pnl >= 0
                      ? "text-growth"
                      : "text-risk"
                  }`}
                >
                  {r.pnlPct === null
                    ? "n/d"
                    : `${r.pnlPct >= 0 ? "+" : ""}${r.pnlPct.toFixed(1)}%`}
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value as "buy" | "sell" | "hold" | "watch" | "";
                    if (v) logDecision(r.p.asset, v);
                    e.target.value = "";
                  }}
                  className="text-xs bg-base-900 border border-base-600 rounded px-1 py-1"
                  title="Registra una decisione"
                >
                  <option value="">log…</option>
                  <option value="buy">buy</option>
                  <option value="sell">sell</option>
                  <option value="hold">hold</option>
                  <option value="watch">watch</option>
                </select>
                <button
                  onClick={() => remove(r.p._id)}
                  className="text-xs text-slate-500 hover:text-risk"
                  title="Elimina"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-slate-600">
        Il registro decisioni è un diario per rivedere le scelte a freddo. Nessun
        ordine viene eseguito.
      </p>
    </div>
  );
}
