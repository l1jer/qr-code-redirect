/**
 * GET: list all redirects and canEdit. Protected.
 * POST: add/update one redirect { slug, targetUrl, name?, note? }. Protected; requires MongoDB.
 * DELETE: remove one redirect { slug }. Protected; requires MongoDB.
 */

import {
  deleteRedirect,
  getRedirects,
  isStorageConfigured,
  setRedirectTarget,
} from "@/lib/kv";
import { getScanCounts } from "@/lib/analytics";
import { getSession, isSessionValid } from "@/lib/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function requireAuth() {
  const session = await getSession(cookies());
  if (!isSessionValid(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  const [redirects, scanCounts] = await Promise.all([
    getRedirects(),
    getScanCounts(),
  ]);
  return NextResponse.json({
    redirects,
    canEdit: isStorageConfigured(),
    scanCounts,
  });
}

export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Add MongoDB (MONGODB_URI and MONGODB_DB) to create or edit links from the UI." },
      { status: 501 }
    );
  }

  let body: { slug?: string; targetUrl?: string; name?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = (body?.slug ?? "").trim();
  const targetUrl = (body?.targetUrl ?? "").trim();
  if (!slug || !targetUrl) {
    return NextResponse.json({ error: "slug and targetUrl are required" }, { status: 400 });
  }
  if (slug.length > 10) {
    return NextResponse.json({ error: "slug must be 10 characters or fewer" }, { status: 400 });
  }

  const name = (body?.name ?? "").trim();
  const note = (body?.note ?? "").trim();

  const result = await setRedirectTarget(slug, targetUrl, name, note);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to save" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Add MongoDB to delete links from the UI." },
      { status: 501 }
    );
  }

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = (body?.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const result = await deleteRedirect(slug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to delete" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
