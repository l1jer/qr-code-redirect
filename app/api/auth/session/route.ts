/**
 * GET -> { "authenticated": boolean } for UI to gate dashboard.
 */

import { getSession, isSessionValid } from "@/lib/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession(cookies());
  return NextResponse.json({
    authenticated: isSessionValid(session),
  });
}
