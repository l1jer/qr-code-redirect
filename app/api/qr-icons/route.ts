import { QR_ICONS } from "@/lib/qr-icons";
import { NextResponse } from "next/server";

export async function GET() {
  const icons = QR_ICONS.map(({ id, label, color, svg }) => ({
    id,
    label,
    color,
    svg: svg ?? null,
  }));
  return NextResponse.json(icons, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
