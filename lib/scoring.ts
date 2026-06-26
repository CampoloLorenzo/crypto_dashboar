import type { CoinScore, MarketCoin, ScoredCoin, Tier } from "@/types";

/**
 * Motore di scoring rischio/crescita — EURISTICO, NON PREDITTIVO.
 *
 * Tutti i punteggi sono ottenuti combinando metriche di mercato pubbliche con
 * pesi fissi e funzioni di normalizzazione lineari/clamp. Non c'è alcun modello
 * statistico né previsione: serve solo a ordinare e contestualizzare le coin in
 * modo coerente, riducendo le decisioni guidate dall'emotività. I numeri vanno
 * sempre mostrati con il disclaimer "euristico, non una previsione".
 *
 * I pesi seguono la specifica (sezione 6). Cambiarli qui cambia il ranking
 * ovunque: è l'unico punto di verità dello scoring.
 */

// --- utility di normalizzazione ---------------------------------------------

const clamp = (v: number, lo = 0, hi = 100): number =>
  Math.max(lo, Math.min(hi, v));

// Mappa linearmente un valore da [inMin,inMax] a [0,100], con clamp.
function scale(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 0;
  return clamp(((value - inMin) / (inMax - inMin)) * 100);
}

// --- GROWTH ------------------------------------------------------------------

const GROWTH_WEIGHTS = {
  momentum7d: 0.25,
  volumeRatio: 0.25,
  athDistance: 0.15,
  trending: 0.15,
  momentum24h: 0.1,
  capTier: 0.1,
};

function growthScore(c: MarketCoin): number {
  // Momentum 7d: -50%..+50% -> 0..100
  const f_momentum7d = scale(c.change7d, -50, 50);

  // Volume/MCap ratio: 0..0.30 -> 0..100 (oltre 30% giornaliero è già estremo)
  const ratio = c.marketCap > 0 ? c.volume24h / c.marketCap : 0;
  const f_volumeRatio = scale(ratio, 0, 0.3);

  // Distanza da ATH: athChangePct è negativo (es. -65 = -65% dall'ATH).
  // Più lontano dall'ATH = più headroom teorico. -90%..0% -> 100..0.
  const distFromAth = Math.abs(Math.min(c.athChangePct, 0)); // 0..~100
  const f_athDistance = scale(distFromAth, 0, 90);

  // Trending: bonus binario.
  const f_trending = c.trending ? 100 : 0;

  // Momentum 24h: -20%..+20% -> 0..100
  const f_momentum24h = scale(c.change24h, -20, 20);

  // Market cap tier: small cap = più upside teorico.
  // > 50B -> 0, < 50M -> 100 (scala logaritmica).
  const f_capTier = capUpsideScore(c.marketCap);

  const growth =
    f_momentum7d * GROWTH_WEIGHTS.momentum7d +
    f_volumeRatio * GROWTH_WEIGHTS.volumeRatio +
    f_athDistance * GROWTH_WEIGHTS.athDistance +
    f_trending * GROWTH_WEIGHTS.trending +
    f_momentum24h * GROWTH_WEIGHTS.momentum24h +
    f_capTier * GROWTH_WEIGHTS.capTier;

  return Math.round(clamp(growth));
}

// Upside potenziale in funzione della market cap (scala log).
// 50M EUR o meno -> 100; 50B EUR o più -> 0.
function capUpsideScore(marketCap: number): number {
  if (marketCap <= 0) return 50; // dato mancante: neutro
  const lo = Math.log10(50_000_000); // ~7.7
  const hi = Math.log10(50_000_000_000); // ~10.7
  const v = Math.log10(marketCap);
  return clamp(100 - scale(v, lo, hi));
}

// --- RISK --------------------------------------------------------------------

const RISK_WEIGHTS = {
  capInverse: 0.3,
  volatility: 0.25,
  liquidity: 0.2,
  athExtreme: 0.15,
  maturity: 0.1,
};

function riskScore(c: MarketCoin): number {
  // Market cap inverso: stessa scala dell'upside (small cap = più rischio).
  const f_capInverse = capUpsideScore(c.marketCap);

  // Volatilità: ampiezza oscillazioni recenti. Usa il range della sparkline 7d
  // se disponibile, altrimenti ripiega sul |change7d|.
  const f_volatility = volatilityScore(c);

  // Liquidità (volume assoluto): volume basso = rischio slippage/manipolazione.
  // < 100k EUR -> rischio 100; > 100M EUR -> rischio 0 (scala log).
  const f_liquidity = liquidityRiskScore(c.volume24h);

  // Distanza ATH estrema: -90% o oltre può indicare progetto morto.
  const distFromAth = Math.abs(Math.min(c.athChangePct, 0));
  const f_athExtreme = scale(distFromAth, 70, 95); // sotto -70% inizia a pesare

  // Età/maturità: proxy = market cap rank (no data storica nel free tier).
  // Rank alto (coin minore/più nuova) = meno track record.
  const f_maturity = maturityRiskScore(c.marketCapRank);

  const risk =
    f_capInverse * RISK_WEIGHTS.capInverse +
    f_volatility * RISK_WEIGHTS.volatility +
    f_liquidity * RISK_WEIGHTS.liquidity +
    f_athExtreme * RISK_WEIGHTS.athExtreme +
    f_maturity * RISK_WEIGHTS.maturity;

  return Math.round(clamp(risk));
}

function volatilityScore(c: MarketCoin): number {
  const spark = c.sparkline7d;
  if (spark && spark.length > 1) {
    const min = Math.min(...spark);
    const max = Math.max(...spark);
    if (min > 0) {
      const rangePct = ((max - min) / min) * 100;
      return scale(rangePct, 0, 60); // 0..60% di range 7d -> 0..100
    }
  }
  return scale(Math.abs(c.change7d), 0, 40);
}

function liquidityRiskScore(volume24h: number): number {
  if (volume24h <= 0) return 100;
  const lo = Math.log10(100_000); // 100k
  const hi = Math.log10(100_000_000); // 100M
  const v = Math.log10(volume24h);
  return clamp(100 - scale(v, lo, hi));
}

function maturityRiskScore(rank: number | null): number {
  if (rank === null) return 70; // fuori dalla classifica = più rischio
  // rank 1 -> 0; rank 250+ -> 100
  return scale(rank, 1, 250);
}

// --- COMPOSITE & TIER --------------------------------------------------------

function compositeScore(growth: number, risk: number): number {
  // Penalizza la crescita in funzione del rischio, senza azzerarla.
  return Math.round(growth * (1 - (risk / 100) * 0.5));
}

function classifyTier(growth: number, risk: number): Tier {
  // L'ordine conta: i casi più specifici prima.
  if (risk >= 75 && growth < 50) return "caution";
  if (growth >= 70 && risk >= 60) return "emerging";
  if (growth >= 60 && risk < 60) return "momentum";
  if (risk < 40) return "stable";
  // fallback ragionevole quando nessuna soglia scatta.
  return risk >= 60 ? "caution" : "momentum";
}

// --- SIGNALS -----------------------------------------------------------------

function detectSignals(c: MarketCoin, growth: number, risk: number): string[] {
  const s: string[] = [];
  const ratio = c.marketCap > 0 ? c.volume24h / c.marketCap : 0;

  if (ratio > 0.15) s.push("volume_spike");
  if (c.athChangePct > -5) s.push("near_ath");
  if (c.athChangePct < -75) s.push("deep_discount");
  if (c.trending) s.push("trending_now");
  if (liquidityRiskScore(c.volume24h) > 70) s.push("low_liquidity");
  if (volatilityScore(c) > 65) s.push("high_volatility");
  if (c.change24h > 3) s.push("momentum_positive");
  if (c.change24h < -3) s.push("momentum_negative");
  if (c.marketCap > 0 && c.marketCap < 100_000_000) s.push("micro_cap");

  return s;
}

// --- Stablecoin --------------------------------------------------------------

// Le stablecoin (e gli asset ancorati a una valuta) non sono "opportunità di
// crescita": il loro alto rapporto volume/mcap inganna l'euristica. Le
// rileviamo per escluderle dal radar. Mix di lista nota + euristica di
// volatilità (robusta anche con prezzi in EUR, dove una stable non vale ~1).
const KNOWN_STABLE = new Set([
  "tether",
  "usd-coin",
  "dai",
  "first-digital-usd",
  "ethena-usde",
  "usds",
  "paypal-usd",
  "true-usd",
  "frax",
  "binance-usd",
  "gemini-dollar",
  "usdd",
  "liquity-usd",
  "tether-eurt",
  "stasis-euro",
  "euro-coin",
]);

const STABLE_SYMBOLS = new Set([
  "usdt",
  "usdc",
  "dai",
  "fdusd",
  "usde",
  "usds",
  "pyusd",
  "tusd",
  "busd",
  "gusd",
  "usdd",
  "lusd",
  "eurt",
  "eurs",
  "eurc",
]);

export function isStablecoin(c: MarketCoin): boolean {
  if (KNOWN_STABLE.has(c.id)) return true;
  if (STABLE_SYMBOLS.has(c.symbol.toLowerCase())) return true;
  // Euristica: oscillazione 7d quasi nulla = ancorata a una valuta.
  const spark = c.sparkline7d;
  if (spark && spark.length > 1) {
    const min = Math.min(...spark);
    const max = Math.max(...spark);
    if (min > 0 && (max - min) / min < 0.015) return true; // < 1.5% di range 7d
  }
  return false;
}

// --- API pubblica ------------------------------------------------------------

export function scoreCoin(c: MarketCoin): CoinScore {
  const growth = growthScore(c);
  const risk = riskScore(c);
  return {
    growth,
    risk,
    composite: compositeScore(growth, risk),
    tier: classifyTier(growth, risk),
    signals: detectSignals(c, growth, risk),
  };
}

export function scoreCoins(coins: MarketCoin[]): ScoredCoin[] {
  return coins
    .map((c) => ({ ...c, isStablecoin: isStablecoin(c), score: scoreCoin(c) }))
    .sort((a, b) => b.score.composite - a.score.composite);
}

// Etichette leggibili (IT) per i segnali — usate dall'UI.
export const SIGNAL_LABELS: Record<string, string> = {
  volume_spike: "Volume spike",
  near_ath: "Vicino all'ATH",
  deep_discount: "Forte sconto",
  trending_now: "Trending",
  low_liquidity: "Bassa liquidità",
  high_volatility: "Alta volatilità",
  momentum_positive: "Momentum positivo",
  momentum_negative: "Momentum negativo",
  micro_cap: "Micro cap",
};
