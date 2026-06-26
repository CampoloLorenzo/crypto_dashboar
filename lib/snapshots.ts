import { getDb, isDbConfigured } from "@/lib/mongodb";
import type { Snapshot } from "@/types";

// Accesso alla collection snapshots. Ritorna null se il DB non è configurato
// o non ci sono ancora snapshot (la UI degrada con eleganza).

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  if (!isDbConfigured()) return null;
  try {
    const db = await getDb();
    const doc = await db
      .collection("snapshots")
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .next();
    if (!doc) return null;
    return { ...doc, _id: String(doc._id) } as unknown as Snapshot;
  } catch {
    return null;
  }
}
