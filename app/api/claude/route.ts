import { NextRequest, NextResponse } from "next/server";
import { chatWithClaude } from "@/lib/claude";
import { getLatestSnapshot } from "@/lib/snapshots";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";

// POST /api/claude — proxy verso Anthropic. La chiave resta server-side.
// Body: { message: string, conversationHistory?: ChatMessage[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body?.message ?? "";
    const history: ChatMessage[] = Array.isArray(body?.conversationHistory)
      ? body.conversationHistory
      : [];

    if (!message.trim()) {
      return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });
    }

    const snapshot = await getLatestSnapshot();
    const reply = await chatWithClaude(message, history, snapshot);

    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json(
      { error: `Errore Claude: ${msg}` },
      { status: 500 }
    );
  }
}
