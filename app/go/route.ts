/**
 * /go redirects to REDIRECT_TARGET_URL from env.
 * Independent from the /go/[slug] multi-link system.
 * Keeps original QR codes that pointed to /go working.
 * Logs each scan under the special slug "__default".
 */

import { isSafeRedirectUrl } from "@/lib/kv";
import { logScan } from "@/lib/analytics";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const target = (process.env.REDIRECT_TARGET_URL ?? "").trim();
  if (!target || !isSafeRedirectUrl(target)) {
    return new NextResponse("Not configured", { status: 404 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const country = request.headers.get("x-vercel-ip-country") ?? undefined;

  logScan({
    slug: "__default",
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
    referer: request.headers.get("referer") ?? undefined,
    country,
  });

  return NextResponse.redirect(target, 302);
}
