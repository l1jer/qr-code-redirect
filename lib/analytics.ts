/**
 * Scan analytics: log each redirect hit and query stats.
 * Uses a separate scan_logs table; does not touch redirects.
 */

import { isSupabaseConfigured } from "@/lib/supabase";

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
  if (!isSupabaseConfigured()) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from("scan_logs").insert({
      slug: input.slug,
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
  if (!isSupabaseConfigured()) return {};
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabase();
    if (!supabase) return {};

    const { data, error } = await supabase
      .rpc("scan_counts_by_slug");

    if (error || !data) {
      // Fallback: manual count if RPC not available
      const { data: raw, error: rawErr } = await supabase
        .from("scan_logs")
        .select("slug");
      if (rawErr || !raw) return {};
      const counts: Record<string, number> = {};
      for (const row of raw) {
        counts[row.slug] = (counts[row.slug] ?? 0) + 1;
      }
      return counts;
    }

    const counts: Record<string, number> = {};
    for (const row of data as { slug: string; count: number }[]) {
      counts[row.slug] = Number(row.count);
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
  if (!isSupabaseConfigured()) return EMPTY_STATS;

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabase();
    if (!supabase) return EMPTY_STATS;

    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [totalRes, h24Res, d7Res, d30Res, allRows, recentRes] = await Promise.all([
      supabase.from("scan_logs").select("id", { count: "exact", head: true }).eq("slug", slug),
      supabase.from("scan_logs").select("id", { count: "exact", head: true }).eq("slug", slug).gte("scanned_at", h24),
      supabase.from("scan_logs").select("id", { count: "exact", head: true }).eq("slug", slug).gte("scanned_at", d7),
      supabase.from("scan_logs").select("id", { count: "exact", head: true }).eq("slug", slug).gte("scanned_at", d30),
      supabase.from("scan_logs")
        .select("scanned_at, ip, user_agent, referer, country")
        .eq("slug", slug)
        .gte("scanned_at", d30)
        .order("scanned_at", { ascending: false })
        .limit(5000),
      supabase.from("scan_logs")
        .select("scanned_at, ip, user_agent, referer, country")
        .eq("slug", slug)
        .order("scanned_at", { ascending: false })
        .limit(50),
    ]);

    const rows = allRows.data ?? [];

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
      totalScans: totalRes.count ?? 0,
      last24h: h24Res.count ?? 0,
      last7d: d7Res.count ?? 0,
      last30d: d30Res.count ?? 0,
      uniqueIPs: ipSet.size,
      topCountries: countries.map((c) => ({ code: c.value, count: c.count })),
      topDevices: devices.map((d) => ({ device: d.value, count: d.count })),
      topReferers: referers.map((r) => ({ referer: r.value, count: r.count })),
      dailyTrend,
      recentScans: (recentRes.data ?? []).map((r) => ({
        scannedAt: r.scanned_at,
        ip: r.ip ?? undefined,
        userAgent: r.user_agent ?? undefined,
        referer: r.referer ?? undefined,
        country: r.country ?? undefined,
      })),
    };
  } catch {
    return EMPTY_STATS;
  }
}
