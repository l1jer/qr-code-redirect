/**
 * GET /api/stats?slug=xxx  -- detailed scan analytics for one slug. Protected.
 */

import { getSlugStats } from "@/lib/analytics";
import { getSession, isSessionValid } from "@/lib/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession(cookies());
  if (!isSessionValid(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug query param is required" }, { status: 400 });
  }

  const stats = await getSlugStats(slug);
  return NextResponse.json(stats);
}
