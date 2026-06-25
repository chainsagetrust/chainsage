import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = "https://chainsage.finance";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ChainSage — Trust Layer for Autonomous Finance",
    template: "%s · ChainSage",
  },
  description:
    "ChainSage is the decision engine between an AI agent's intent and on-chain execution. Settlement moves money. Authorization grants permission. ChainSage decides whether it should happen.",
  keywords: [
    "ChainSage",
    "autonomous finance",
    "trust layer",
    "AI agents",
    "risk API",
    "agent SDK",
    "policy engine",
    "on-chain verdict",
  ],
  authors: [{ name: "ChainSage" }],
  openGraph: {
    title: "ChainSage — Trust Layer for Autonomous Finance",
    description:
      "The verdict before execution. ChainSage decides whether an agent's transaction should happen — ALLOW, REVIEW, or DENY.",
    url: SITE_URL,
    siteName: "ChainSage",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChainSage — Trust Layer for Autonomous Finance",
    description: "The verdict before execution. ALLOW · REVIEW · DENY.",
    site: "@chainsagetrust",
    creator: "@chainsagetrust",
  },
  icons: {
    icon: "/favicon.svg",
  },
  other: {
    "virtual-protocol-site-verification": "28dd54833147f98202c70ae90f957f8e",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0816",
  width: "device-width",
  initialScale: 1,
};

// Set theme before paint to avoid flash; default to Midnight.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('chainsage-theme');
    if (t !== 'midnight' && t !== 'aurora') t = 'midnight';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'midnight');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="midnight" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${hanken.variable} ${jetbrains.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
