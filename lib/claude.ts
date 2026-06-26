import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, Snapshot } from "@/types";

// Wrapper per l'SDK Anthropic. La chiave resta SEMPRE server-side.

export const MODEL_ANALYSIS = "claude-sonnet-4-6";
export const MODEL_BATCH = "claude-haiku-4-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

// Costruisce un riassunto compatto del mercato da iniettare nel system prompt.
function buildMarketContext(snapshot: Snapshot | null): string {
  if (!snapshot) return "Nessuno snapshot di mercato disponibile al momento.";

  const g = snapshot.global;
  const fg = snapshot.fearGreed;
  const top = snapshot.coins
    .slice(0, 12)
    .map(
      (c) =>
        `- ${c.symbol.toUpperCase()} (${c.name}): prezzo €${c.price}, 24h ${c.change24h.toFixed(
          1
        )}%, 7d ${c.change7d.toFixed(1)}%, growth ${c.score.growth}, risk ${
          c.score.risk
        }, composite ${c.score.composite}, tier ${c.score.tier}`
    )
    .join("\n");

  return [
    `Snapshot del ${new Date(snapshot.timestamp).toLocaleString("it-IT")}.`,
    `Market cap totale: €${Math.round(g.totalMarketCap).toLocaleString("it-IT")}, ` +
      `BTC dominance ${g.btcDominance.toFixed(1)}%, variazione mcap 24h ${g.marketCapChange24h.toFixed(1)}%.`,
    `Fear & Greed: ${fg.value}/100 (${fg.label}).`,
    `Top coin per composite score (growth/risk sono euristici, 0-100):`,
    top,
  ].join("\n");
}

const SYSTEM_PROMPT = `Sei un analista crypto oggettivo all'interno di una dashboard di intelligence.

REGOLE NON NEGOZIABILI:
- Rispondi SEMPRE in italiano.
- Fornisci dati, trend, metriche e contesto oggettivo. Spiega i trade-off.
- NON dare MAI consigli finanziari personalizzati del tipo "compra X" o "vendi Y".
- NON promettere rendimenti né fare previsioni di prezzo garantite.
- Quando citi gli score growth/risk/composite, ricorda che sono EURISTICI e informativi, non predittivi.
- Se ti viene chiesto un consiglio d'acquisto diretto, riformula verso i dati: cosa dicono le metriche, quali sono i rischi, cosa monitorare.
- Sii conciso e concreto. Usa i dati di mercato forniti nel contesto quando pertinenti.

Lo scopo dello strumento è ridurre gli errori evitabili guidati dalla FOMO, non promettere guadagni.`;

export async function chatWithClaude(
  message: string,
  history: ChatMessage[],
  snapshot: Snapshot | null
): Promise<string> {
  const anthropic = getClient();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const response = await anthropic.messages.create({
    model: MODEL_ANALYSIS,
    max_tokens: 1024,
    system: `${SYSTEM_PROMPT}\n\n--- CONTESTO DI MERCATO ---\n${buildMarketContext(snapshot)}`,
    messages,
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
