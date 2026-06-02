import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const thai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-thai", display: "swap" });

export const metadata: Metadata = {
  title: "JR OMS — JR Aluminium and Glass",
  description: "ระบบจัดการงาน JR Aluminium and Glass",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c1f37" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${inter.variable} ${thai.variable}`}>
      <body style={{ fontFamily: "var(--font-inter), var(--font-thai), sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
