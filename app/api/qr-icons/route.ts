import { QR_ICONS } from "@/lib/qr-icons";
import { NextResponse } from "next/server";

export async function GET() {
  const icons = QR_ICONS.map(({ id, label, color, svg, file }) => ({
    id,
    label,
    color,
    svg: svg ?? null,
    file: file ?? null,
  }));
  return NextResponse.json(icons, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
