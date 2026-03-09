/**
 * Multiple redirects by slug. Stored in Supabase table "redirects" (slug, target_url).
 * When Supabase is not configured, a single env REDIRECT_TARGET_URL is exposed as slug "default" (read-only).
 */

const ALLOWED = /^https?:\/\//i;
const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

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

/** Get target URL for one slug. */
export async function getRedirectTarget(slug: string): Promise<string | null> {
  const redirects = await getRedirects();
  const url = (redirects[slug] ?? "").trim();
  return isSafeRedirectUrl(url) ? url : null;
}

/** List all slug -> url. When no Supabase, returns { default: REDIRECT_TARGET_URL } if set. */
export async function getRedirects(): Promise<Record<string, string>> {
  if (isStorageConfigured()) {
    const supabase = (await import("@/lib/supabase")).getSupabase();
    if (!supabase) return fallbackRedirects();
    try {
      const { data, error } = await supabase.from("redirects").select("slug, target_url");
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const row of data ?? []) {
        const k = (row as { slug: string; target_url: string }).slug;
        const v = (row as { slug: string; target_url: string }).target_url;
        if (isValidSlug(k) && isSafeRedirectUrl(String(v).trim())) out[k] = String(v).trim();
      }
      return out;
    } catch {
      /* fall through */
    }
  }
  return fallbackRedirects();
}

function fallbackRedirects(): Record<string, string> {
  const fromEnv = (process.env.REDIRECT_TARGET_URL ?? "").trim();
  if (fromEnv && isSafeRedirectUrl(fromEnv)) {
    return { default: fromEnv };
  }
  return {};
}

/** Add or update one redirect. Requires Supabase. */
export async function setRedirectTarget(
  slug: string,
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug must be 1–64 characters, letters, numbers, hyphen, underscore only." };
  }
  const trimmed = (url ?? "").trim();
  if (!isSafeRedirectUrl(trimmed)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }

  const supabase = (await import("@/lib/supabase")).getSupabase();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await supabase.from("redirects").upsert(
      { slug, target_url: trimmed },
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
