/**
 * Encrypted session for TOTP-authenticated admin access.
 * Requires AUTH_SECRET (32+ chars) in env.
 */

import { getIronSession, SessionOptions } from "iron-session";

const password = process.env.AUTH_SECRET ?? "";
const MIN_PASSWORD_LENGTH = 32;

export interface SessionData {
  verifiedAt?: number;
}

export const sessionOptions: SessionOptions = {
  password: password.length >= MIN_PASSWORD_LENGTH ? password : "x".repeat(MIN_PASSWORD_LENGTH),
  cookieName: "qr_redirect_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export function isSessionConfigured(): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export async function getSession(
  cookieStore: ReturnType<typeof import("next/headers").cookies>
) {
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

const MAX_AGE_MS = 60 * 60 * 24 * 1000; // 24h

export function isSessionValid(session: SessionData): boolean {
  const at = session?.verifiedAt;
  if (typeof at !== "number") return false;
  return Date.now() - at < MAX_AGE_MS;
}
