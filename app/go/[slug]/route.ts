/**
 * Public redirect: 302 to the target URL for this slug.
 * No auth; used as the URL encoded in the QR code.
 * Logs each scan for analytics (fire-and-forget).
 */

import { getRedirectTarget, isSafeRedirectUrl } from "@/lib/kv";
import { logScan } from "@/lib/analytics";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const target = await getRedirectTarget(slug);
  if (!target || !isSafeRedirectUrl(target)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const country = request.headers.get("x-vercel-ip-country") ?? undefined;

  logScan({
    slug,
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
    referer: request.headers.get("referer") ?? undefined,
    country,
  });

  return NextResponse.redirect(target, 302);
}
