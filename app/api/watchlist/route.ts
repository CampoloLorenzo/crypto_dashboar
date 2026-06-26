import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, isDbConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json(
    { error: "Database non configurato (MONGODB_URI mancante)" },
    { status: 503 }
  );
}

// GET /api/watchlist — elenco coin osservate.
export async function GET() {
  if (!isDbConfigured()) return noDb();
  try {
    const db = await getDb();
    const docs = await db
      .collection("watchlist")
      .find({})
      .sort({ addedAt: -1 })
      .toArray();
    const items = docs.map((d) => ({ ...d, _id: String(d._id) }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/watchlist — aggiunge { coinId, symbol }. Evita i duplicati.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) return noDb();
  try {
    const body = await req.json();
    const coinId = String(body?.coinId ?? "").trim();
    const symbol = String(body?.symbol ?? "").trim();
    if (!coinId) {
      return NextResponse.json({ error: "coinId mancante" }, { status: 400 });
    }
    const db = await getDb();
    await db.collection("watchlist").updateOne(
      { coinId },
      { $setOnInsert: { coinId, symbol, addedAt: new Date().toISOString() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/watchlist?id=<_id>  oppure  ?coinId=<coinId>
export async function DELETE(req: NextRequest) {
  if (!isDbConfigured()) return noDb();
  try {
    const id = req.nextUrl.searchParams.get("id");
    const coinId = req.nextUrl.searchParams.get("coinId");
    const db = await getDb();
    if (id) {
      await db.collection("watchlist").deleteOne({ _id: new ObjectId(id) });
    } else if (coinId) {
      await db.collection("watchlist").deleteOne({ coinId });
    } else {
      return NextResponse.json({ error: "id o coinId mancante" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
