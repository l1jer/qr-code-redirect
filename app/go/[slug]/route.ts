/**
 * Public redirect: 302 to the target URL for this slug.
 * No auth; used as the URL encoded in the QR code.
 */

import { getRedirectTarget, isSafeRedirectUrl } from "@/lib/kv";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const target = await getRedirectTarget(slug);
  if (!target || !isSafeRedirectUrl(target)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.redirect(target, 302);
}
