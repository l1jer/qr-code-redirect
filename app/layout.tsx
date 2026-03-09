import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Redirect",
  description: "Manage redirect target and QR code",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
