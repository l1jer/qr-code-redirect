/**
 * Multiple redirects by slug. Stored in Supabase table "redirects" (slug, target_url, name, note).
 * When Supabase is not configured, a single env REDIRECT_TARGET_URL is exposed as slug "default" (read-only).
 */

const ALLOWED = /^https?:\/\//i;
const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_TEXT = 500;

export interface RedirectEntry {
  slug: string;
  targetUrl: string;
  name: string;
  note: string;
}

export function isSafeRedirectUrl(url: string): boolean {
  return typeof url === "string" && url.length > 0 && ALLOWED.test(url.trim());
}

export function isValidSlug(slug: string): boolean {
  return typeof slug === "string" && SLUG_REGEX.test(slug);
}

export function isStorageConfigured(): boolean {
  const prefix = (process.env.SUPABASE_ENV_PREFIX ?? "").trim();
  const url = prefix
    ? process.env[`${prefix}_SUPABASE_URL`]
    : process.env.SUPABASE_URL;
  const key = prefix
    ? process.env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`]
    : process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
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
    const supabase = (await import("@/lib/supabase")).getSupabase();
    if (!supabase) return fallbackRedirects();
    try {
      const { data, error } = await supabase
        .from("redirects")
        .select("slug, target_url, name, note")
        .order("slug");
      if (error) throw error;
      const out: RedirectEntry[] = [];
      for (const row of data ?? []) {
        const r = row as { slug: string; target_url: string; name?: string; note?: string };
        if (isValidSlug(r.slug) && isSafeRedirectUrl(String(r.target_url).trim())) {
          out.push({
            slug: r.slug,
            targetUrl: String(r.target_url).trim(),
            name: String(r.name ?? "").slice(0, MAX_TEXT),
            note: String(r.note ?? "").slice(0, MAX_TEXT),
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

/** Add or update one redirect. Requires Supabase. */
export async function setRedirectTarget(
  slug: string,
  url: string,
  name: string,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug must be 1-64 characters, letters, numbers, hyphen, underscore only." };
  }
  const trimmedUrl = (url ?? "").trim();
  if (!isSafeRedirectUrl(trimmedUrl)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }

  const supabase = (await import("@/lib/supabase")).getSupabase();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await supabase.from("redirects").upsert(
      {
        slug,
        target_url: trimmedUrl,
        name: (name ?? "").slice(0, MAX_TEXT),
        note: (note ?? "").slice(0, MAX_TEXT),
      },
      { onConflict: "slug" }
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase write failed";
    return { ok: false, error: msg };
  }
}

/** Remove one redirect. Requires Supabase. */
export async function deleteRedirect(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Invalid slug." };
  }

  const supabase = (await import("@/lib/supabase")).getSupabase();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await supabase.from("redirects").delete().eq("slug", slug);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Supabase delete failed";
    return { ok: false, error: msg };
  }
}
