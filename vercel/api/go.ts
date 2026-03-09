/**
 * QR redirect: 302 to REDIRECT_TARGET_URL.
 * Deploy on Vercel; set env REDIRECT_TARGET_URL in Dashboard.
 */

const TARGET = process.env.REDIRECT_TARGET_URL ?? "";
const ALLOWED = /^https?:\/\//i;

function isSafeUrl(url: string): boolean {
  return url.length > 0 && ALLOWED.test(url.trim());
}

export function GET(_request: Request): Response {
  const target = TARGET.trim();
  if (!target || !isSafeUrl(target)) {
    return new Response("Redirect not configured", { status: 503 });
  }
  return Response.redirect(target, 302);
}
