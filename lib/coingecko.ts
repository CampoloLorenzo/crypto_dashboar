import type { GlobalMarket, MarketCoin } from "@/types";

// Wrapper minimale per CoinGecko free tier.
// - usa EUR come valuta (coerente con lo schema snapshot)
// - aggiunge la key Pro solo se presente (free tier funziona senza)
// - imposta una revalidate di default per sfruttare la cache di Next/fetch
//   e non sbattere sul rate limit del free tier.

const FREE_BASE = "https://api.coingecko.com/api/v3";
const PRO_BASE = "https://pro-api.coingecko.com/api/v3";

const apiKey = process.env.COINGECKO_API_KEY || "";
const BASE = apiKey ? PRO_BASE : FREE_BASE;
const VS = "eur";

interface FetchOpts {
  revalidate?: number; // secondi
}

async function cgFetch<T>(
  path: string,
  params: Record<string, string | number | boolean> = {},
  opts: FetchOpts = {}
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["x-cg-pro-api-key"] = apiKey;

  const res = await fetch(url.toString(), {
    headers,
    next: { revalidate: opts.revalidate ?? 90 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CoinGecko ${res.status} su ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ---- /coins/markets ---------------------------------------------------------

interface RawMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_24h?: number | null;
  ath_change_percentage: number | null;
  sparkline_in_7d?: { price: number[] };
}

function mapMarketCoin(r: RawMarketCoin): MarketCoin {
  return {
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    image: r.image,
    price: r.current_price ?? 0,
    marketCap: r.market_cap ?? 0,
    marketCapRank: r.market_cap_rank ?? null,
    volume24h: r.total_volume ?? 0,
    change24h:
      r.price_change_percentage_24h_in_currency ??
      r.price_change_percentage_24h ??
      0,
    change7d: r.price_change_percentage_7d_in_currency ?? 0,
    athChangePct: r.ath_change_percentage ?? 0,
    sparkline7d: r.sparkline_in_7d?.price,
  };
}

// Top coin per market cap. `ids` opzionale per fetchare coin specifiche.
export async function getMarkets(
  opts: { perPage?: number; page?: number; ids?: string[]; revalidate?: number } = {}
): Promise<MarketCoin[]> {
  const params: Record<string, string | number | boolean> = {
    vs_currency: VS,
    order: "market_cap_desc",
    per_page: opts.perPage ?? 50,
    page: opts.page ?? 1,
    sparkline: true,
    price_change_percentage: "24h,7d",
  };
  if (opts.ids?.length) params.ids = opts.ids.join(",");

  const raw = await cgFetch<RawMarketCoin[]>("/coins/markets", params, {
    revalidate: opts.revalidate,
  });
  return raw.map(mapMarketCoin);
}

// ---- /global ----------------------------------------------------------------

interface RawGlobal {
  data: {
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
}

export async function getGlobal(revalidate?: number): Promise<GlobalMarket> {
  const raw = await cgFetch<RawGlobal>("/global", {}, { revalidate });
  const d = raw.data;
  return {
    totalMarketCap: d.total_market_cap[VS] ?? 0,
    btcDominance: d.market_cap_percentage.btc ?? 0,
    totalVolume24h: d.total_volume[VS] ?? 0,
    marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? 0,
  };
}

// ---- /search/trending -------------------------------------------------------

interface RawTrending {
  coins: { item: { id: string } }[];
}

export async function getTrendingIds(revalidate?: number): Promise<string[]> {
  const raw = await cgFetch<RawTrending>("/search/trending", {}, { revalidate });
  return raw.coins.map((c) => c.item.id);
}

// ---- /coins/{id}/ohlc -------------------------------------------------------

// Ritorna [timestamp, open, high, low, close][]
export async function getOhlc(
  id: string,
  days = 7,
  revalidate?: number
): Promise<number[][]> {
  return cgFetch<number[][]>(
    `/coins/${id}/ohlc`,
    { vs_currency: VS, days },
    { revalidate }
  );
}
