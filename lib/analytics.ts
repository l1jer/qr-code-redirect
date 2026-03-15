/**
 * Scan analytics: log each redirect hit and query stats.
 * Uses MongoDB collection "scan_logs"; does not touch redirects.
 */

import { ensureMongoIndexes, getDb, isMongoConfigured } from "@/lib/mongodb";

export interface ScanLogInput {
  slug: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
  country?: string;
}

export interface SlugStats {
  totalScans: number;
  last24h: number;
  last7d: number;
  last30d: number;
  uniqueIPs: number;
  topCountries: { code: string; count: number }[];
  topDevices: { device: string; count: number }[];
  topReferers: { referer: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
  recentScans: RecentScan[];
}

export interface RecentScan {
  scannedAt: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
  country?: string;
}

function classifyDevice(ua: string): string {
  const lower = ua.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/i.test(lower)) return "Tablet";
  if (/iphone|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(lower)) return "Mobile";
  if (/bot|crawl|spider|slurp|mediapartners/i.test(lower)) return "Bot";
  return "Desktop";
}

function topN<T extends string>(
  items: (T | null | undefined)[],
  limit: number,
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/** Fire-and-forget: insert a scan log row. Does not block the redirect. */
export async function logScan(input: ScanLogInput): Promise<void> {
  if (!isMongoConfigured()) return;
  try {
    await ensureMongoIndexes();
    const db = await getDb();
    await db.collection("scan_logs").insertOne({
      slug: input.slug,
      scanned_at: new Date(),
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      referer: input.referer ?? null,
      country: input.country ?? null,
    });
  } catch {
    // Silently fail; analytics must never break the redirect.
  }
}

/** Get scan counts per slug (total). */
export async function getScanCounts(): Promise<Record<string, number>> {
  if (!isMongoConfigured()) return {};
  try {
    await ensureMongoIndexes();
    const db = await getDb();
    const grouped = await db
      .collection("scan_logs")
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$slug", count: { $sum: 1 } } },
      ])
      .toArray();
    const counts: Record<string, number> = {};
    for (const row of grouped) {
      if (!row._id) continue;
      counts[row._id] = Number(row.count);
    }
    return counts;
  } catch {
    return {};
  }
}

const EMPTY_STATS: SlugStats = {
  totalScans: 0, last24h: 0, last7d: 0, last30d: 0,
  uniqueIPs: 0, topCountries: [], topDevices: [], topReferers: [],
  dailyTrend: [], recentScans: [],
};

/** Get detailed stats for one slug. */
export async function getSlugStats(slug: string): Promise<SlugStats> {
  if (!isMongoConfigured()) return EMPTY_STATS;

  try {
    await ensureMongoIndexes();
    const db = await getDb();
    const scanLogs = db.collection("scan_logs");

    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalScans, last24h, last7d, last30d, allRows, recentRows] = await Promise.all([
      scanLogs.countDocuments({ slug }),
      scanLogs.countDocuments({ slug, scanned_at: { $gte: h24 } }),
      scanLogs.countDocuments({ slug, scanned_at: { $gte: d7 } }),
      scanLogs.countDocuments({ slug, scanned_at: { $gte: d30 } }),
      scanLogs
        .find(
          { slug, scanned_at: { $gte: d30 } },
          { projection: { _id: 0, scanned_at: 1, ip: 1, user_agent: 1, referer: 1, country: 1 } }
        )
        .sort({ scanned_at: -1 })
        .limit(5000)
        .toArray(),
      scanLogs
        .find(
          { slug },
          { projection: { _id: 0, scanned_at: 1, ip: 1, user_agent: 1, referer: 1, country: 1 } }
        )
        .sort({ scanned_at: -1 })
        .limit(50)
        .toArray(),
    ]);

    const rows = allRows.map((r) => ({
      scanned_at: toIsoDate(r.scanned_at),
      ip: toOptionalString(r.ip),
      user_agent: toOptionalString(r.user_agent),
      referer: toOptionalString(r.referer),
      country: toOptionalString(r.country),
    }));

    // Unique IPs
    const ipSet = new Set<string>();
    for (const r of rows) { if (r.ip) ipSet.add(r.ip); }

    // Top countries
    const countries = topN(rows.map((r) => r.country), 10);

    // Device type breakdown
    const deviceLabels = rows.map((r) => r.user_agent ? classifyDevice(r.user_agent) : null);
    const devices = topN(deviceLabels, 5);

    // Top referers (clean up nulls / empty)
    const referers = topN(
      rows.map((r) => {
        if (!r.referer) return null;
        try { return new URL(r.referer).hostname; } catch { return r.referer; }
      }),
      8,
    );

    // Daily trend (last 30 days)
    const dayCounts = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayCounts.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      const day = r.scanned_at?.slice(0, 10);
      if (day && dayCounts.has(day)) {
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }
    }
    const dailyTrend = [...dayCounts.entries()].map(([date, count]) => ({ date, count }));

    return {
      totalScans,
      last24h,
      last7d,
      last30d,
      uniqueIPs: ipSet.size,
      topCountries: countries.map((c) => ({ code: c.value, count: c.count })),
      topDevices: devices.map((d) => ({ device: d.value, count: d.count })),
      topReferers: referers.map((r) => ({ referer: r.value, count: r.count })),
      dailyTrend,
      recentScans: recentRows.map((r) => ({
        scannedAt: toIsoDate(r.scanned_at),
        ip: toOptionalString(r.ip),
        userAgent: toOptionalString(r.user_agent),
        referer: toOptionalString(r.referer),
        country: toOptionalString(r.country),
      })),
    };
  } catch {
    return EMPTY_STATS;
  }
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
