// Tipi condivisi dell'applicazione.

export type Tier = "emerging" | "momentum" | "stable" | "caution";

export interface CoinScore {
  growth: number; // 0-100, potenziale di crescita stimato (euristico)
  risk: number; // 0-100, livello di rischio (euristico)
  composite: number; // 0-100, growth penalizzato dal rischio
  signals: string[]; // segnali attivi leggibili (chiavi i18n-friendly)
  tier: Tier;
}

// Dato grezzo di mercato per una coin (sottoinsieme di CoinGecko /coins/markets).
export interface MarketCoin {
  id: string; // "bitcoin"
  symbol: string; // "btc"
  name: string;
  image?: string;
  price: number;
  marketCap: number;
  marketCapRank: number | null;
  volume24h: number;
  change24h: number; // % 24h
  change7d: number; // % 7d
  athChangePct: number; // % distanza dall'ATH (negativa)
  sparkline7d?: number[]; // serie prezzi 7d (se disponibile)
  trending?: boolean; // presente nella top trending CoinGecko
  isStablecoin?: boolean; // stablecoin: esclusa dal radar opportunità
}

// Coin arricchita con lo scoring — è ciò che finisce nello snapshot.
export interface ScoredCoin extends MarketCoin {
  score: CoinScore;
}

export interface GlobalMarket {
  totalMarketCap: number; // EUR
  btcDominance: number; // %
  totalVolume24h: number;
  marketCapChange24h: number; // %
}

export interface FearGreed {
  value: number; // 0-100
  label: string; // classificazione
}

export interface Snapshot {
  _id?: string;
  timestamp: string; // ISO
  global: GlobalMarket;
  fearGreed: FearGreed;
  coins: ScoredCoin[];
}

export interface WatchlistEntry {
  _id?: string;
  coinId: string;
  symbol: string;
  addedAt: string;
}

export interface Position {
  _id?: string;
  asset: string;
  qty: number;
  buyPrice: number;
  buyDate: string;
  notes?: string;
}

export interface Decision {
  _id?: string;
  timestamp: string;
  asset: string;
  action: "buy" | "sell" | "hold" | "watch";
  rationale: string;
  marketContext: Record<string, unknown>;
}

export interface AlertLog {
  _id?: string;
  timestamp: string;
  type: string;
  coinId: string;
  message: string;
  sent: boolean;
}

// Messaggio chat per l'assistente AI.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
