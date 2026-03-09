/**
 * POST { "code": "123456" } -> verify TOTP, set session cookie.
 * Rate-limited: 5 failed attempts per IP within 5 minutes triggers a lockout.
 */

import { getSession, isSessionConfigured } from "@/lib/session";
import { isRateLimited, recordFailedAttempt, clearAttempts, remainingSeconds } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/totp";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

function getClientIp(): string {
  const h = headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  if (!isSessionConfigured()) {
    return NextResponse.json(
      { error: "Auth not configured (missing AUTH_SECRET)" },
      { status: 503 }
    );
  }

  const ip = getClientIp();

  if (isRateLimited(ip)) {
    const secs = remainingSeconds(ip);
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${secs}s.` },
      { status: 429 }
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = (body?.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const valid = await verifyTotp(code);
  if (!valid) {
    recordFailedAttempt(ip);
    if (isRateLimited(ip)) {
      const secs = remainingSeconds(ip);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${secs}s.` },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  clearAttempts(ip);

  const session = await getSession(cookies());
  session.verifiedAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true });
}
