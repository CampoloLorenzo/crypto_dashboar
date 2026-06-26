import { NextRequest, NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/snapshots";
import { getDb, isDbConfigured } from "@/lib/mongodb";

export const dynamic = "force-dynamic"; // sempre l'ultimo snapshot dal DB
export const runtime = "nodejs";

// GET /api/snapshot — ultimo snapshot calcolato dal cron. È ciò che la
// dashboard legge di default (zero fetch pesante lato client).
export async function GET(req: NextRequest) {
  // Modalità diagnostica: /api/snapshot?debug=1 espone l'errore reale.
  if (req.nextUrl.searchParams.get("debug") === "1") {
    try {
      if (!isDbConfigured()) {
        return NextResponse.json({ debug: "MONGODB_URI non configurata" });
      }
      const db = await getDb();
      const count = await db.collection("snapshots").countDocuments();
      const doc = await db
        .collection("snapshots")
        .find({})
        .sort({ timestamp: -1 })
        .limit(1)
        .next();
      return NextResponse.json({
        debug: "ok",
        dbName: db.databaseName,
        count,
        lastTimestamp: doc?.timestamp ?? null,
        coins: doc?.coins?.length ?? null,
      });
    } catch (e) {
      return NextResponse.json({
        debug: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const snapshot = await getLatestSnapshot();
  if (!snapshot) {
    return NextResponse.json(
      { snapshot: null, message: "Nessuno snapshot disponibile. Esegui il refresh." },
      { status: 200 }
    );
  }
  return NextResponse.json({ snapshot });
}
