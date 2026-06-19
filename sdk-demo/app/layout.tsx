import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-hanken" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Agent SDK · ChainSage",
  description:
    "Machines call the verdict. An autonomous agent gated by chainsage.check() before it signs — ALLOW / REVIEW / DENY on live Base.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0A0816" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="midnight">
      <body className={`${hanken.variable} ${jetbrains.variable}`}>{children}</body>
    </html>
  );
}
