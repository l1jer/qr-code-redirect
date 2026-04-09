/**
 * TOTP verification for Google Authenticator compatibility.
 * Requires TOTP_SECRET (base32) in env.
 */

import { verify } from "otplib";
import { env } from "@/lib/env";

const TOTP_SECRET = env("TOTP_SECRET");

export function isTotpConfigured(): boolean {
  return TOTP_SECRET.length >= 16;
}

export async function verifyTotp(token: string): Promise<boolean> {
  const t = (token ?? "").trim().replace(/\s/g, "");
  if (!t || t.length !== 6 || !/^\d+$/.test(t)) return false;
  if (!isTotpConfigured()) return false;

  try {
    const result = await verify({ secret: TOTP_SECRET, token: t });
    return result.valid === true;
  } catch {
    return false;
  }
}
