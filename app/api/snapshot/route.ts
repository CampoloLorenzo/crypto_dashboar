import { NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/snapshots";

export const dynamic = "force-dynamic"; // sempre l'ultimo snapshot dal DB
export const runtime = "nodejs";

// GET /api/snapshot — ultimo snapshot calcolato dal cron. È ciò che la
// dashboard legge di default (zero fetch pesante lato client).
export async function GET() {
  const snapshot = await getLatestSnapshot();
  if (!snapshot) {
    return NextResponse.json(
      { snapshot: null, message: "Nessuno snapshot disponibile. Esegui il refresh." },
      { status: 200 }
    );
  }
  return NextResponse.json({ snapshot });
}
