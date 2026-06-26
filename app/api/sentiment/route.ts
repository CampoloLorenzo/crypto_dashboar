import { NextResponse } from "next/server";
import type { FearGreed } from "@/types";

export const revalidate = 300; // il Fear & Greed cambia lentamente
export const runtime = "nodejs";

interface RawFng {
  data: { value: string; value_classification: string }[];
}

// Etichetta italiana per la classificazione.
const LABELS: Record<string, string> = {
  "Extreme Fear": "Paura estrema",
  Fear: "Paura",
  Neutral: "Neutrale",
  Greed: "Avidità",
  "Extreme Greed": "Avidità estrema",
};

// GET /api/sentiment — Fear & Greed index (Alternative.me, nessuna key).
export async function GET() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);

    const raw = (await res.json()) as RawFng;
    const item = raw.data?.[0];
    if (!item) throw new Error("risposta vuota");

    const fearGreed: FearGreed = {
      value: Number(item.value),
      label: LABELS[item.value_classification] ?? item.value_classification,
    };
    return NextResponse.json(fearGreed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json(
      { error: `Fear & Greed non disponibile: ${msg}` },
      { status: 503 }
    );
  }
}
