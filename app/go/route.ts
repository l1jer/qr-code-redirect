/**
 * /go redirects to REDIRECT_TARGET_URL from env.
 * Independent from the /go/[slug] multi-link system.
 * Keeps original QR codes that pointed to /go working.
 */

import { isSafeRedirectUrl } from "@/lib/kv";
import { NextResponse } from "next/server";

export async function GET() {
  const target = (process.env.REDIRECT_TARGET_URL ?? "").trim();
  if (!target || !isSafeRedirectUrl(target)) {
    return new NextResponse("Not configured", { status: 404 });
  }
  return NextResponse.redirect(target, 302);
}
