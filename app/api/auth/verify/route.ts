/**
 * POST { "code": "123456" } -> verify TOTP, set session cookie.
 */

import { getSession, isSessionConfigured, isSessionValid, sessionOptions } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSessionConfigured()) {
    return NextResponse.json(
      { error: "Auth not configured (missing AUTH_SECRET)" },
      { status: 503 }
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
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const session = await getSession(cookies());
  session.verifiedAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true });
}
