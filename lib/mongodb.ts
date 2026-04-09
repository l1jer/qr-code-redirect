import { Db, MongoClient } from "mongodb";
import { env } from "@/lib/env";

function readMongoEnv(name: string): string {
  const value = env(name);
  if (value) return value;

  // Fallback: Vercel Mongo integration uses QRCG_ prefix
  if (name === "MONGODB_URI") {
    const qrcg = process.env.QRCG_MONGODB_URI;
    if (qrcg?.trim()) return qrcg.trim();
  }
  if (name === "MONGODB_DB") {
    const qrcg = process.env.QRCG_MONGODB_DB;
    if (qrcg?.trim()) return qrcg.trim();
  }

  return "";
}

const mongoUri = readMongoEnv("MONGODB_URI");
const mongoDbName = readMongoEnv("MONGODB_DB");

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __mongoIndexesPromise: Promise<void> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!mongoUri) {
    throw new Error("MongoDB not configured");
  }

  if (!global.__mongoClientPromise) {
    const client = new MongoClient(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    global.__mongoClientPromise = client.connect();
  }
  return global.__mongoClientPromise;
}

export function isMongoConfigured(): boolean {
  return Boolean(mongoUri && mongoDbName);
}

export async function getDb(): Promise<Db> {
  if (!mongoUri || !mongoDbName) {
    throw new Error("MongoDB not configured");
  }
  const client = await getClientPromise();
  return client.db(mongoDbName);
}

export async function ensureMongoIndexes(): Promise<void> {
  if (!isMongoConfigured()) return;
  if (global.__mongoIndexesPromise) {
    await global.__mongoIndexesPromise;
    return;
  }

  global.__mongoIndexesPromise = (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection("redirects").createIndex({ slug: 1 }, { unique: true }),
      db.collection("scan_logs").createIndex({ slug: 1 }),
      db.collection("scan_logs").createIndex({ scanned_at: -1 }),
      db.collection("scan_logs").createIndex({ slug: 1, scanned_at: -1 }),
    ]);
  })();

  await global.__mongoIndexesPromise;
}
