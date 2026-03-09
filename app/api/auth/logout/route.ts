/**
 * POST -> clear session cookie.
 */

import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getSession(cookies());
  session.destroy();
  return NextResponse.json({ ok: true });
}
