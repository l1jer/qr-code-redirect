/**
 * GET ?slug=xxx -> PNG QR code for origin + /go/xxx.
 * Slug is required so each link has its own QR.
 */

import { getRedirectTarget } from "@/lib/kv";
import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return new NextResponse("Missing slug", { status: 400 });
  }

  const target = await getRedirectTarget(slug);
  if (!target) {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectUrl = base.replace(/\/$/, "") + "/go/" + encodeURIComponent(slug);

  try {
    const buffer = await QRCode.toBuffer(redirectUrl, { type: "png", margin: 2 });
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new NextResponse("QR generation failed", { status: 500 });
  }
}
