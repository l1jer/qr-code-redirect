#!/usr/bin/env node
/**
 * Generate a TOTP secret for Google Authenticator.
 * Add the printed secret to .env as TOTP_SECRET=... and add it to your authenticator app.
 * Run: npm run totp-setup
 */

import * as crypto from "crypto";

function base32Secret(): string {
  const bytes = crypto.randomBytes(20);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 31];
    }
  }
  return out;
}

const secret = base32Secret();
const appName = "QR Redirect";
const otpauth =
  "otpauth://totp/" + encodeURIComponent(appName) + ":admin?secret=" + secret + "&issuer=" + encodeURIComponent(appName);

console.log("Add this to your .env (and to Vercel Environment Variables):");
console.log("");
console.log("TOTP_SECRET=" + secret);
console.log("");
console.log("Then add this secret to Google Authenticator (or any TOTP app):");
console.log("- Manual entry: " + secret);
console.log("- Or scan a QR code generated from this otpauth URL (paste into a QR generator):");
console.log(otpauth);
