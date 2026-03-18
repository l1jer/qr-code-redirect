/**
 * GET ?slug=xxx -> PNG QR code for origin + /go/xxx, with logo overlay.
 * Slug is required so each link has its own QR.
 */

import { getRedirectTarget } from "@/lib/kv";
import QRCode from "qrcode";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import * as path from "node:path";
import * as fs from "node:fs";

let logoCached: Buffer | null = null;

function loadLogo(): Buffer | null {
  if (logoCached) return logoCached;
  const logoPath = path.join(process.cwd(), "public", "flywing-icon.png");
  if (!fs.existsSync(logoPath)) return null;
  logoCached = fs.readFileSync(logoPath);
  return logoCached;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return new NextResponse("Missing slug", { status: 400 });
  }

  const target = await getRedirectTarget(slug);
  if (!target) {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;
  const redirectUrl = base.replace(/\/$/, "") + "/go/" + encodeURIComponent(slug);

  try {
    const qrSize = 512;
    const qrBuffer = await QRCode.toBuffer(redirectUrl, {
      type: "png",
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    const logoRaw = loadLogo();
    if (!logoRaw) {
      return new NextResponse(new Uint8Array(qrBuffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
      });
    }

    const logoSize = Math.round(qrSize * 0.2);
    const logoPadding = Math.round(logoSize * 0.12);
    const bgSize = logoSize + logoPadding * 2;
    const offset = Math.round((qrSize - bgSize) / 2);

    const logoResized = await sharp(logoRaw)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    const whiteBg = await sharp({
      create: {
        width: bgSize,
        height: bgSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 },
      },
    })
      .composite([{ input: logoResized, left: logoPadding, top: logoPadding }])
      .png()
      .toBuffer();

    const composited = await sharp(qrBuffer)
      .composite([{ input: whiteBg, left: offset, top: offset }])
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(composited), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new NextResponse("QR generation failed", { status: 500 });
  }
}
