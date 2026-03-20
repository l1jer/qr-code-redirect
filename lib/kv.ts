/**
 * Multiple redirects by slug, stored in MongoDB collection "redirects".
 */

import { ensureMongoIndexes, getDb, isMongoConfigured } from "@/lib/mongodb";

const ALLOWED = /^https?:\/\//i;
const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,10}$/;
const MAX_TEXT = 500;

export interface RedirectEntry {
  slug: string;
  targetUrl: string;
  name: string;
  note: string;
  qrIcon: string;
}

interface RedirectDoc {
  slug: string;
  target_url: string;
  name?: string;
  note?: string;
  qr_icon?: string;
}

export function isSafeRedirectUrl(url: string): boolean {
  return typeof url === "string" && url.length > 0 && ALLOWED.test(url.trim());
}

export function isValidSlug(slug: string): boolean {
  return typeof slug === "string" && SLUG_REGEX.test(slug);
}

export function isStorageConfigured(): boolean {
  return isMongoConfigured();
}

/** Get target URL for one slug (used by public /go/[slug]). */
export async function getRedirectTarget(slug: string): Promise<string | null> {
  const all = await getRedirects();
  const entry = all.find((e) => e.slug === slug);
  return entry && isSafeRedirectUrl(entry.targetUrl) ? entry.targetUrl : null;
}

/** List all redirect entries. */
export async function getRedirects(): Promise<RedirectEntry[]> {
  if (isStorageConfigured()) {
    try {
      await ensureMongoIndexes();
      const db = await getDb();
      const rows = await db
        .collection<RedirectDoc>("redirects")
        .find(
          {},
          {
            projection: {
              _id: 0,
              slug: 1,
              target_url: 1,
              name: 1,
              note: 1,
              qr_icon: 1,
            },
          }
        )
        .sort({ slug: 1 })
        .toArray();

      const out: RedirectEntry[] = [];
      for (const row of rows) {
        if (isValidSlug(row.slug) && isSafeRedirectUrl(String(row.target_url).trim())) {
          out.push({
            slug: row.slug,
            targetUrl: String(row.target_url).trim(),
            name: String(row.name ?? "").slice(0, MAX_TEXT),
            note: String(row.note ?? "").slice(0, MAX_TEXT),
            qrIcon: String(row.qr_icon ?? ""),
          });
        }
      }
      return out;
    } catch {
      /* fall through */
    }
  }
  return fallbackRedirects();
}

function fallbackRedirects(): RedirectEntry[] {
  return [];
}

/** Add or update one redirect. Requires MongoDB. */
export async function setRedirectTarget(
  slug: string,
  url: string,
  name: string,
  note: string,
  qrIcon?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug must be 1-10 characters, letters, numbers, hyphen, underscore only." };
  }
  const trimmedUrl = (url ?? "").trim();
  if (!isSafeRedirectUrl(trimmedUrl)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }

  if (!isMongoConfigured()) {
    return { ok: false, error: "MongoDB not configured" };
  }

  try {
    await ensureMongoIndexes();
    const db = await getDb();
    await db.collection("redirects").updateOne(
      { slug },
      {
        $set: {
          target_url: trimmedUrl,
          name: (name ?? "").slice(0, MAX_TEXT),
          note: (note ?? "").slice(0, MAX_TEXT),
          qr_icon: (qrIcon ?? "").slice(0, 30),
        },
      },
      { upsert: true }
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MongoDB write failed";
    return { ok: false, error: msg };
  }
}

/** Remove one redirect. Requires MongoDB. */
export async function deleteRedirect(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Invalid slug." };
  }

  if (!isMongoConfigured()) {
    return { ok: false, error: "MongoDB not configured" };
  }

  try {
    await ensureMongoIndexes();
    const db = await getDb();
    await db.collection("redirects").deleteOne({ slug });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MongoDB delete failed";
    return { ok: false, error: msg };
  }
}
