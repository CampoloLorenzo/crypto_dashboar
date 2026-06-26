import { MongoClient, Db } from "mongodb";

// Connessione singleton riutilizzabile tra le invocazioni serverless.
// In dev, conserviamo il client su globalThis per evitare di aprire una nuova
// connessione ad ogni hot-reload.

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "crypto_intel";

let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI non configurata");
  }
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

// True se il DB è configurato (utile per degradare con eleganza in dev).
export function isDbConfigured(): boolean {
  return Boolean(uri);
}
