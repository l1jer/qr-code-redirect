/**
 * GET ?slug=xxx[&icon=instagram] -> PNG QR code with optional centre icon overlay.
 * icon values: "logo" (default company icon), social media id, or "none".
 * If no icon param is provided, falls back to the link's stored qr_icon, then "logo".
 */

import { getRedirects } from "@/lib/kv";
import { getQrIconDef } from "@/lib/qr-icons";
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

async function svgToPng(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return new NextResponse("Missing slug", { status: 400 });
  }

  const allRedirects = await getRedirects();
  const entry = allRedirects.find((e) => e.slug === slug);
  if (!entry) {
    return new NextResponse("Not found", { status: 404 });
  }

  const iconParam = request.nextUrl.searchParams.get("icon")?.trim();
  const requestedIconId = iconParam || entry.qrIcon || "logo";
  const iconId = requestedIconId === "none" || requestedIconId === "logo" || getQrIconDef(requestedIconId)
    ? requestedIconId
    : "logo";

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

    if (iconId === "none") {
      return new NextResponse(new Uint8Array(qrBuffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
      });
    }

    const logoSize = Math.round(qrSize * 0.2);
    const logoPadding = Math.round(logoSize * 0.12);
    const bgSize = logoSize + logoPadding * 2;
    const offset = Math.round((qrSize - bgSize) / 2);

    let iconPng: Buffer | null = null;

    if (iconId === "logo") {
      const logoRaw = loadLogo();
      if (logoRaw) {
        iconPng = await sharp(logoRaw)
          .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer();
      }
    } else {
      const def = getQrIconDef(iconId);
      if (def?.svg) {
        iconPng = await svgToPng(def.svg, logoSize);
      }
    }

    if (!iconPng) {
      return new NextResponse(new Uint8Array(qrBuffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
      });
    }

    const whiteBg = await sharp({
      create: {
        width: bgSize,
        height: bgSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 },
      },
    })
      .composite([{ input: iconPng, left: logoPadding, top: logoPadding }])
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
