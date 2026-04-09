/**
 * Icon registry for QR code centre overlays.
 * Social media icon paths come from simple-icons; brand logos use file-based images
 * stored in public/.
 */

import {
  siFacebook,
  siInstagram,
  siTiktok,
  siWechat,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons/icons";

export interface QrIconDef {
  id: string;
  label: string;
  color: string;
  svg?: string;
  /** Public path for file-based icons (e.g. "/tsa-logo.png") */
  file?: string;
}

function iconSvg(path: string, hex: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${hex}"><path d="${path}"/></svg>`;
}

function instagramGradientSvg(path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#F58529"/>
        <stop offset="35%" stop-color="#DD2A7B"/>
        <stop offset="70%" stop-color="#8134AF"/>
        <stop offset="100%" stop-color="#515BD4"/>
      </linearGradient>
    </defs>
    <path d="${path}" fill="url(#ig-gradient)"/>
  </svg>`;
}

export const QR_ICONS: QrIconDef[] = [
  { id: "logo", label: "TSA", color: "#2563eb", file: "/tsa-logo.png" },
  { id: "pulsar", label: "Pulsar", color: "#1e40af", file: "/pulsar-logo.svg" },
  { id: "nt", label: "NT", color: "#374151", file: "/nt-logo.png" },
  { id: "sw", label: "SW", color: "#374151", file: "/sw-logo.jpg" },
  { id: "zt", label: "ZT", color: "#374151", file: "/zt-logo.png" },
  { id: "instagram", label: "Instagram", color: "#DD2A7B", svg: instagramGradientSvg(siInstagram.path) },
  { id: "facebook", label: "Facebook", color: `#${siFacebook.hex}`, svg: iconSvg(siFacebook.path, siFacebook.hex) },
  { id: "youtube", label: "YouTube", color: `#${siYoutube.hex}`, svg: iconSvg(siYoutube.path, siYoutube.hex) },
  { id: "tiktok", label: "TikTok", color: `#${siTiktok.hex}`, svg: iconSvg(siTiktok.path, siTiktok.hex) },
  { id: "x", label: "X", color: `#${siX.hex}`, svg: iconSvg(siX.path, siX.hex) },
  { id: "whatsapp", label: "WhatsApp", color: `#${siWhatsapp.hex}`, svg: iconSvg(siWhatsapp.path, siWhatsapp.hex) },
  { id: "wechat", label: "WeChat", color: `#${siWechat.hex}`, svg: iconSvg(siWechat.path, siWechat.hex) },
  { id: "none", label: "None", color: "#78716c" },
];

export function getQrIconDef(id: string): QrIconDef | undefined {
  return QR_ICONS.find((i) => i.id === id);
}

export const QR_ICON_IDS = QR_ICONS.map((i) => i.id);
