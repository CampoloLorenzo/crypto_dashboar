import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json(
    { error: "Database non configurato (MONGODB_URI mancante)" },
    { status: 503 }
  );
}

const ACTIONS = new Set(["buy", "sell", "hold", "watch"]);

// GET /api/decisions — log decisioni (più recenti prima).
export async function GET() {
  if (!isDbConfigured()) return noDb();
  try {
    const db = await getDb();
    const docs = await db
      .collection("decisions")
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    const items = docs.map((d) => ({ ...d, _id: String(d._id) }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/decisions — { asset, action, rationale, marketContext? }
// È un diario delle scelte, prezioso per rivederle a freddo. NON esegue nulla.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) return noDb();
  try {
    const b = await req.json();
    const asset = String(b?.asset ?? "").trim();
    const action = String(b?.action ?? "").trim();
    if (!asset || !ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "asset e action (buy|sell|hold|watch) obbligatori" },
        { status: 400 }
      );
    }
    const doc = {
      timestamp: new Date().toISOString(),
      asset,
      action,
      rationale: String(b?.rationale ?? ""),
      marketContext:
        b?.marketContext && typeof b.marketContext === "object"
          ? b.marketContext
          : {},
    };
    const db = await getDb();
    const res = await db.collection("decisions").insertOne(doc);
    return NextResponse.json({ ok: true, id: String(res.insertedId) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
