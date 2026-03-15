#!/usr/bin/env node
/**
 * One-time migration: copy redirects and scan logs from Supabase to MongoDB.
 *
 * Usage:
 *   npm run migrate:supabase-to-mongodb
 */

import { createClient } from "@supabase/supabase-js";
import { MongoClient } from "mongodb";
import * as fs from "node:fs";

type SupabaseRedirectRow = {
  slug: string;
  target_url: string;
  name: string | null;
  note: string | null;
};

type SupabaseScanLogRow = {
  slug: string;
  scanned_at: string;
  ip: string | null;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
};

function loadEnvFromDotenv(path: string): Record<string, string> {
  if (!fs.existsSync(path)) return {};
  const text = fs.readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

function envValue(name: string, dotenv: Record<string, string>): string {
  const runtime = process.env[name];
  if (runtime && runtime.trim()) return runtime.trim();
  const fromFile = dotenv[name];
  return (fromFile ?? "").trim();
}

function getSupabaseCredentials(dotenv: Record<string, string>): { url: string; key: string } {
  const prefix = envValue("SUPABASE_ENV_PREFIX", dotenv);
  const url = prefix
    ? envValue(`${prefix}_SUPABASE_URL`, dotenv)
    : envValue("SUPABASE_URL", dotenv);
  const key = prefix
    ? envValue(`${prefix}_SUPABASE_SERVICE_ROLE_KEY`, dotenv)
    : envValue("SUPABASE_SERVICE_ROLE_KEY", dotenv);
  return { url, key };
}

function getMongoCredentials(dotenv: Record<string, string>): { uri: string; dbName: string } {
  const customPrefix = envValue("MONGODB_ENV_PREFIX", dotenv);
  const uri =
    (customPrefix ? envValue(`${customPrefix}_MONGODB_URI`, dotenv) : "") ||
    envValue("QRCG_MONGODB_URI", dotenv) ||
    envValue("MONGODB_URI", dotenv);
  const dbName =
    (customPrefix ? envValue(`${customPrefix}_MONGODB_DB`, dotenv) : "") ||
    envValue("QRCG_MONGODB_DB", dotenv) ||
    envValue("MONGODB_DB", dotenv);
  return { uri, dbName };
}

async function run(): Promise<void> {
  const dotenv = loadEnvFromDotenv(".env");
  const { url, key } = getSupabaseCredentials(dotenv);
  const { uri, dbName } = getMongoCredentials(dotenv);

  if (!url || !key) {
    throw new Error("Supabase credentials missing. Check SUPABASE_ENV_PREFIX and Supabase env vars.");
  }
  if (!uri || !dbName) {
    throw new Error("MongoDB credentials missing. Check QRCG_MONGODB_URI/MONGODB_URI and MONGODB_DB.");
  }

  const supabase = createClient(url, key);
  const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await mongo.connect();
  const db = mongo.db(dbName);
  const redirectsCol = db.collection("redirects");
  const scanLogsCol = db.collection("scan_logs");

  await Promise.all([
    redirectsCol.createIndex({ slug: 1 }, { unique: true }),
    scanLogsCol.createIndex({ slug: 1 }),
    scanLogsCol.createIndex({ scanned_at: -1 }),
    scanLogsCol.createIndex({ slug: 1, scanned_at: -1 }),
  ]);

  console.log("Fetching redirects from Supabase...");
  const redirectsRes = await supabase
    .from("redirects")
    .select("slug, target_url, name, note")
    .order("slug");
  if (redirectsRes.error) {
    throw new Error(`Failed to fetch redirects: ${redirectsRes.error.message}`);
  }
  const redirects = (redirectsRes.data ?? []) as SupabaseRedirectRow[];
  console.log(`Fetched redirects: ${redirects.length}`);

  console.log("Fetching scan_logs from Supabase...");
  const pageSize = 1000;
  const scanLogs: SupabaseScanLogRow[] = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("scan_logs")
      .select("slug, scanned_at, ip, user_agent, referer, country")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch scan_logs ${from}-${to}: ${error.message}`);
    }

    const rows = (data ?? []) as SupabaseScanLogRow[];
    scanLogs.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Fetched scan_logs: ${scanLogs.length}`);

  console.log("Writing redirects to MongoDB...");
  if (redirects.length > 0) {
    const ops = redirects.map((r) => ({
      updateOne: {
        filter: { slug: r.slug },
        update: {
          $set: {
            target_url: r.target_url,
            name: r.name ?? "",
            note: r.note ?? "",
          },
        },
        upsert: true,
      },
    }));
    await redirectsCol.bulkWrite(ops, { ordered: false });
  }

  console.log("Replacing scan_logs in MongoDB...");
  await scanLogsCol.deleteMany({});
  if (scanLogs.length > 0) {
    const batchSize = 2000;
    for (let i = 0; i < scanLogs.length; i += batchSize) {
      const chunk = scanLogs.slice(i, i + batchSize);
      await scanLogsCol.insertMany(
        chunk.map((r) => ({
          slug: r.slug,
          scanned_at: new Date(r.scanned_at),
          ip: r.ip,
          user_agent: r.user_agent,
          referer: r.referer,
          country: r.country,
        })),
        { ordered: false }
      );
    }
  }

  const [mongoRedirectCount, mongoScanCount, supabaseRedirectCount, supabaseScanCount] = await Promise.all([
    redirectsCol.countDocuments({}),
    scanLogsCol.countDocuments({}),
    supabase.from("redirects").select("slug", { count: "exact", head: true }),
    supabase.from("scan_logs").select("slug", { count: "exact", head: true }),
  ]);

  console.log("");
  console.log("Migration summary");
  console.log("-----------------");
  console.log(`Supabase redirects: ${supabaseRedirectCount.count ?? 0}`);
  console.log(`MongoDB redirects:  ${mongoRedirectCount}`);
  console.log(`Supabase scan_logs: ${supabaseScanCount.count ?? 0}`);
  console.log(`MongoDB scan_logs:  ${mongoScanCount}`);

  if ((supabaseRedirectCount.count ?? 0) !== mongoRedirectCount) {
    throw new Error("Redirect count mismatch after migration.");
  }
  if ((supabaseScanCount.count ?? 0) !== mongoScanCount) {
    throw new Error("scan_logs count mismatch after migration.");
  }

  await mongo.close();
  console.log("Migration completed successfully.");
}

run().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
