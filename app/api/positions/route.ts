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

// GET /api/positions — posizioni di portafoglio.
export async function GET() {
  if (!isDbConfigured()) return noDb();
  try {
    const db = await getDb();
    const docs = await db
      .collection("positions")
      .find({})
      .sort({ buyDate: -1 })
      .toArray();
    const items = docs.map((d) => ({ ...d, _id: String(d._id) }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/positions — { asset, qty, buyPrice, buyDate?, notes? }
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) return noDb();
  try {
    const b = await req.json();
    const asset = String(b?.asset ?? "").trim();
    const qty = Number(b?.qty);
    const buyPrice = Number(b?.buyPrice);
    if (!asset || !Number.isFinite(qty) || !Number.isFinite(buyPrice)) {
      return NextResponse.json(
        { error: "asset, qty e buyPrice sono obbligatori" },
        { status: 400 }
      );
    }
    const doc = {
      asset,
      qty,
      buyPrice,
      buyDate: b?.buyDate || new Date().toISOString(),
      notes: b?.notes ? String(b.notes) : undefined,
    };
    const db = await getDb();
    const res = await db.collection("positions").insertOne(doc);
    return NextResponse.json({ ok: true, id: String(res.insertedId) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/positions?id=<_id>
export async function DELETE(req: NextRequest) {
  if (!isDbConfigured()) return noDb();
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 });
    const db = await getDb();
    await db.collection("positions").deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
